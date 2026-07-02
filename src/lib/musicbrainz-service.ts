const MB_BASE_URL = 'https://musicbrainz.org/ws/2';
const CAA_BASE_URL = 'https://coverartarchive.org';
const USER_AGENT = 'HarmonyMusicApp/1.0 (https://github.com/harmony-music)';
const RATE_LIMIT_MS = 1100;

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, { headers: { 'User-Agent': USER_AGENT } });
}

async function safeFetch<T>(url: string, extractor: (d: any) => T, fallback: T): Promise<T> {
  try {
    const res = await rateLimitedFetch(url);
    if (!res.ok) return fallback;
    const data = await res.json();
    return extractor(data);
  } catch {
    return fallback;
  }
}

export interface MBArtist {
  id: string;
  name: string;
  sort_name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  gender?: string;
  life_span?: { begin?: string; end?: string };
  tags?: Array<{ name: string }>;
  score?: number;
}

export interface MBReleaseGroup {
  id: string;
  title: string;
  'first-release-date': string;
  'primary-type': string;
  'secondary-type'?: string;
  'artist-credit'?: Array<{ artist: { id: string; name: string } }>;
  coverUrl?: string;
}

export interface MBRecording {
  id: string;
  title: string;
  length?: number;
  'artist-credit'?: Array<{ artist: { id: string; name: string } }>;
  'release-list': Array<{ id: string; title: string; date: string }>;
}

export interface MBSyncResult {
  artist: MBArtist | null;
  releaseGroups: MBReleaseGroup[];
  recordings: MBRecording[];
  totalTracks: number;
  totalAlbums: number;
  syncedAt: string;
  source: 'full' | 'basic';
}

export async function searchArtist(name: string): Promise<MBArtist[]> {
  return safeFetch(
    `${MB_BASE_URL}/artist?query=${encodeURIComponent(name)}&fmt=json&limit=5`,
    (d) => d.artists || [],
    [],
  );
}

export async function getArtistFullInfo(mbid: string): Promise<{ artist: MBArtist; releaseGroups: MBReleaseGroup[] }> {
  const raw = await safeFetch<any>(
    `${MB_BASE_URL}/artist/${mbid}?inc=release-groups+tags+url-rels&fmt=json`,
    (d) => d,
    null,
  );
  if (!raw) return { artist: null as any, releaseGroups: [] };

  const artist: MBArtist = {
    id: raw.id,
    name: raw.name,
    sort_name: raw['sort-name'],
    type: raw.type,
    country: raw.country,
    disambiguation: raw.disambiguation,
    gender: raw.gender,
    life_span: raw['life-span'],
    tags: raw.tags,
  };
  const releaseGroups: MBReleaseGroup[] = raw['release-groups'] || [];
  return { artist, releaseGroups };
}

export async function getArtistRecordings(mbid: string): Promise<MBRecording[]> {
  return safeFetch(
    `${MB_BASE_URL}/recording?artist=${mbid}&fmt=json&limit=100&inc=release+artist-credits`,
    (d) => d.recordings || [],
    [],
  );
}

export async function getReleaseGroupCoverArt(releaseGroupId: string): Promise<string | null> {
  try {
    const res = await rateLimitedFetch(`${CAA_BASE_URL}/release-group/${releaseGroupId}/front`);
    if (res.ok && res.status !== 404) {
      return res.url;
    }
    return null;
  } catch {
    return null;
  }
}

export async function syncArtistInfo(artistName: string): Promise<MBSyncResult> {
  const artists = await searchArtist(artistName);
  const artist = artists[0] || null;

  if (!artist) {
    return { artist: null, releaseGroups: [], recordings: [], totalTracks: 0, totalAlbums: 0, syncedAt: new Date().toISOString(), source: 'basic' };
  }

  const [fullInfo, recordings] = await Promise.all([
    getArtistFullInfo(artist.id),
    getArtistRecordings(artist.id),
  ]);

  const dedupedRecordings = recordings.filter((r, i, self) => self.findIndex(x => x.title === r.title) === i);

  const rgs = fullInfo.releaseGroups.slice(0, 20);
  const coverLimit = Math.min(rgs.length, 5);
  for (let i = 0; i < coverLimit; i++) {
    try {
      const coverUrl = await getReleaseGroupCoverArt(rgs[i].id);
      if (coverUrl) {
        rgs[i].coverUrl = coverUrl;
      }
    } catch {
    }
  }

  return {
    artist: fullInfo.artist,
    releaseGroups: rgs,
    recordings: dedupedRecordings,
    totalTracks: dedupedRecordings.length,
    totalAlbums: fullInfo.releaseGroups.length,
    syncedAt: new Date().toISOString(),
    source: 'full',
  };
}
