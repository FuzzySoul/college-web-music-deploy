import asyncio
import os
import re
import threading
import time as _time
from typing import Optional

import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from cache import cache
from config import REST_URL, SUPABASE_SERVICE_KEY

app = FastAPI(title="Cache Proxy Service")

allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "*")
allowed_origins = ["*"] if allowed_origins_env == "*" else [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
app_base_url = os.getenv("APP_BASE_URL", "http://localhost:5000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

client: Optional[httpx.AsyncClient] = None

_mb_processing: set[str] = set()

_consecutive_errors = 0
_MAX_ERRORS = 5
_HEALTH_CHECK_INTERVAL = 30
_last_health_check = 0.0


async def _create_client():
    global client
    limits = httpx.Limits(
        max_keepalive_connections=10,
        max_connections=20,
        keepalive_expiry=30.0,
    )
    client = httpx.AsyncClient(
        base_url=REST_URL,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        timeout=httpx.Timeout(connect=10.0, read=15.0, write=15.0, pool=5.0),
        limits=limits,
        follow_redirects=True,
    )


async def _fetch_with_retry(method: str, url: str, params=None, max_retries=3):
    global _consecutive_errors
    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            if method == "GET":
                resp = await client.get(url, params=params)
            elif method == "POST":
                resp = await client.post(url, json=params)
            else:
                return None
            resp.raise_for_status()
            if _consecutive_errors > 0:
                print(f"[retry] Recovery after {_consecutive_errors} errors")
                cache.exit_offline_mode()
                _consecutive_errors = 0
            return resp.json()
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.HTTPStatusError) as e:
            last_exc = e
            if attempt < max_retries:
                delay = min(2 ** attempt, 5)
                await asyncio.sleep(delay)
            continue
        except Exception as e:
            last_exc = e
            break
    _consecutive_errors += 1
    if _consecutive_errors >= _MAX_ERRORS:
        print(f"[health] {_consecutive_errors} consecutive errors, entering offline mode")
        cache.enter_offline_mode()
    return None


async def fetch_table(table: str, params: dict = None):
    return await _fetch_with_retry("GET", f"/{table}", params=params)


async def fetch_single(table: str, filters: dict, params: dict = None):
    p = dict(filters)
    if params:
        p.update(params)
    data = await _fetch_with_retry("GET", f"/{table}", params=p)
    if data is not None and isinstance(data, list) and len(data) > 0:
        return data[0]
    return data


async def fetch_count(table: str, filters: dict = None):
    try:
        headers = dict(client.headers)
        headers["Prefer"] = "count=exact"
        params = {"select": "id", "limit": "1"}
        if filters:
            params.update(filters)
        resp = await client.get(f"/{table}", params=params, headers=headers)
        content_range = resp.headers.get("content-range", "0-0/0")
        total = content_range.split("/")[-1]
        return int(total) if total.isdigit() else 0
    except Exception:
        return 0


async def health_check():
    global _consecutive_errors
    try:
        start = _time.time()
        resp = await client.get("/playlists", params={"select": "id", "limit": "1"}, timeout=httpx.Timeout(read=3.0))
        elapsed = (_time.time() - start) * 1000
        if resp.status_code == 200:
            if _consecutive_errors > 0:
                print(f"[health] Recovered! latency={elapsed:.0f}ms")
                cache.exit_offline_mode()
                _consecutive_errors = 0
            return True
        return False
    except Exception:
        return False


def bg_refresh(cache_key: str, coro, ttl: int = 300):
    if not cache.start_refresh(cache_key):
        return

    async def _run():
        try:
            result = await coro
            if result is not None:
                cache.set(cache_key, result, ttl)
        except Exception as e:
            print(f"[bg_refresh] {cache_key} error: {e}")
        finally:
            cache.finish_refresh(cache_key)

    threading.Thread(target=lambda: asyncio.run(_run()), daemon=True).start()


@app.on_event("startup")
async def startup():
    await _create_client()

    print("[startup] Pre-warming cache...")
    try:
        await asyncio.gather(
            _warm_admin_stats(),
            _warm_admin_playlists(),
            _warm_admin_albums(),  # 专辑管理聚合启动预热
            _warm_admin_tables(),
            _warm_home_aggregate(),
            _warm_artists(),
            _warm_explore(),
            _warm_playlists(),  # M1: 预热歌单聚合缓存，避免首次进入歌单页 cache miss
        )
        print(f"[startup] Pre-warm complete: {len(cache._store)} entries")
    except Exception as e:
        print(f"[startup] Pre-warm error: {e}")

    asyncio.create_task(_health_check_loop())
    print("[startup] Health check loop started")


async def _health_check_loop():
    while True:
        await asyncio.sleep(_HEALTH_CHECK_INTERVAL)
        healthy = await health_check()
        if not healthy:
            print("[health] Unhealthy, attempting to rebuild client...")
            try:
                await _create_client()
                healthy = await health_check()
                if healthy:
                    print("[health] Client rebuilt successfully")
            except Exception as e:
                print(f"[health] Rebuild failed: {e}")


async def _warm_admin_stats():
    try:
        data = await _fetch_admin_stats()
        if data:
            cache.set("admin:stats", data, 300)
    except Exception:
        pass


async def _warm_admin_playlists():
    try:
        data = await _fetch_admin_playlists()
        if data:
            cache.set("admin:playlists:all", data, 300)
    except Exception:
        pass


async def _warm_admin_albums():
    """专辑管理聚合启动预热：消除首次进入专辑管理页的 N+1 卡顿"""
    try:
        data = await _fetch_admin_albums_aggregate(1, 50, "")
        if data:
            cache.set("admin:albums:all:page1:limit50:search", data, 300)
    except Exception:
        pass


async def _warm_admin_tables():
    for table in ["users", "artists", "tracks", "playlists", "external_playlists", "comments", "albums"]:
        try:
            data = await _fetch_admin_table(table, 1, 50, "")
            if data:
                cache.set(f"admin:{table}:page1:limit50:search", data, 300)
        except Exception:
            pass


async def _warm_home_aggregate():
    try:
        data = await _fetch_home_aggregate()
        if data:
            cache.set("home:aggregate", data, 120)
    except Exception:
        pass


async def _warm_artists():
    try:
        data = await _fetch_artists()
        if data:
            cache.set("artists", data, 300)
    except Exception:
        pass


async def _warm_explore():
    try:
        data = await _fetch_explore()
        if data:
            cache.set("explore", data, 600)
    except Exception:
        pass


async def _warm_playlists():  # M1: 歌单聚合启动预热
    try:
        data = await _fetch_playlists()
        if data:
            cache.set("playlists", data, 120)  # M2: TTL 与规则对齐 120s
            print(f"[startup] playlists pre-warmed: local={len(data.get('local', []))}, external={len(data.get('external', []))}")
    except Exception as e:
        print(f"[startup] _warm_playlists failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    if client:
        await client.aclose()


async def _fetch_admin_stats():
    users_count, artists_count, tracks_count, playlists_count, external_playlists_count, favorites_count, playlist_favorites_count, recent_comments = await asyncio.gather(
        fetch_count("users"),
        fetch_count("artists"),
        fetch_count("tracks"),
        fetch_count("playlists"),
        fetch_count("external_playlists"),
        fetch_count("favorites"),
        fetch_count("playlist_favorites"),
        fetch_table("comments", {"select": "*", "is_deleted": "eq.false", "order": "created_at.desc", "limit": "5"}),
    )
    if recent_comments is None:
        recent_comments = []
    return {
        "users": users_count,
        "artists": artists_count,
        "tracks": tracks_count,
        "playlists": playlists_count + external_playlists_count,
        "localPlaylists": playlists_count,
        "externalPlaylists": external_playlists_count,
        "favorites": favorites_count,
        "playlistFavorites": playlist_favorites_count,
        "recentComments": recent_comments,
    }


async def _fetch_admin_playlists():
    local_p, external_p, local_counts, users = await asyncio.gather(
        fetch_table("playlists", {"select": "id,name,description,cover,is_public,platform_source,external_playlist_id,platform_playlist_id,track_count,created_at,user_id", "order": "created_at.desc"}),
        fetch_table("external_playlists", {"select": "id,name,cover_url,track_count,platform_id,platform_playlist_id,source,created_at,user_id", "order": "created_at.desc"}),
        fetch_table("playlist_tracks", {"select": "playlist_id"}),
        fetch_table("users", {"select": "id,username,email"}),
    )
    if local_p is None or external_p is None:
        return None
    count_map = {}
    if local_counts:
        for item in local_counts:
            pid = item.get("playlist_id")
            count_map[pid] = count_map.get(pid, 0) + 1
    # user_id → username 映射
    user_map: dict[str, str] = {}
    if users:
        for u in users:
            uid = u.get("id")
            user_map[uid] = u.get("username") or (u.get("email") or "").split("@")[0] or "站内用户"
    for p in local_p:
        uid = p.get("user_id")
        p["track_count"] = count_map.get(p.get("id"), 0)
        p["created_by"] = user_map.get(uid, "未知用户") if uid else "未知用户"
    for p in external_p:
        uid = p.get("user_id")
        name = user_map.get(uid, "未知用户") if uid else "未知用户"
        p["created_by"] = f"{name} 同步" if p.get("source") == "platform" else name
    return {"local": local_p, "external": external_p}


async def _fetch_admin_albums_aggregate(page: int, limit: int, search: str):
    """专辑管理聚合：一次返回专辑列表 + 每个专辑的歌曲数（合并 tracks 表按 album 字段聚合）"""
    offset = (page - 1) * limit
    params = {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }
    count_filters: dict = {}
    if search:
        params["or"] = f"(name.ilike.*{search}*,artist.ilike.*{search}*)"
        count_filters["or"] = f"(name.ilike.*{search}*,artist.ilike.*{search}*)"

    total = await fetch_count("albums", count_filters if count_filters else None)
    albums_data, tracks_data = await asyncio.gather(
        fetch_table("albums", params),
        fetch_table("tracks", {"select": "album"}),
    )
    if albums_data is None:
        return None

    # 按 album 字段聚合 tracks 歌曲数
    track_count_map: dict[str, int] = {}
    if tracks_data:
        for t in tracks_data:
            key = (t.get("album") or "").strip()
            if key:
                track_count_map[key] = track_count_map.get(key, 0) + 1

    for a in albums_data:
        a["track_count"] = track_count_map.get((a.get("name") or "").strip(), 0)

    return {
        "data": albums_data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": max(1, -(-total // limit)),
        },
    }


async def _fetch_admin_table(table: str, page: int, limit: int, search: str):
    offset = (page - 1) * limit
    params = {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }
    count_filters = {}
    if search:
        search_map = {
            "tracks": f"(title.ilike.*{search}*,artist.ilike.*{search}*,album.ilike.*{search}*)",
            "artists": f"(name.ilike.*{search}*,alias.ilike.*{search}*)",
            "playlists": f"(name.ilike.*{search}*,description.ilike.*{search}*)",
            "comments": f"(content.ilike.*{search}*,username.ilike.*{search}*)",
        }
        if table in search_map:
            params["or"] = search_map[table]
            count_filters["or"] = search_map[table]

    total = await fetch_count(table, count_filters if count_filters else None)
    data = await fetch_table(table, params)
    if data is None:
        return None
    return {
        "data": data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": max(1, -(-total // limit)),
        },
    }


async def _fetch_home_aggregate():
    tracks, local_playlists, external_playlists, artists, albums = await asyncio.gather(
        fetch_table("tracks", {"select": "*", "order": "created_at.desc", "limit": "50"}),
        fetch_table("playlists", {"select": "id,name,description,cover,is_public,platform_source,external_playlist_id,track_count,created_at", "order": "created_at.desc"}),
        fetch_table("external_playlists", {"select": "id,name,cover_url,track_count,platform_id,platform_playlist_id,source,created_at", "order": "created_at.desc"}),
        fetch_table("artists", {"select": "*", "order": "created_at.desc"}),
        fetch_table("albums", {"select": "*", "order": "created_at.desc"}),
    )
    if tracks is None or local_playlists is None or external_playlists is None:
        return None
    return {
        "tracks": tracks,
        "localPlaylists": local_playlists,
        "externalPlaylists": external_playlists,
        "artists": artists or [],
        "albums": albums or [],
    }


async def _fetch_artists():
    artists_data, albums_data, external_tracks = await asyncio.gather(
        fetch_table("artists", {"select": "*", "order": "created_at.desc"}),
        fetch_table("albums", {"select": "*", "order": "created_at.desc"}),
        fetch_table("external_playlist_tracks", {"select": "track_artist"}),
    )
    if artists_data is None:
        return None
    external_artists_set: set[str] = set()
    for t in (external_tracks or []):
        artist_str = t.get("track_artist")
        if not artist_str:
            continue
        for name in re.split(r"[,，、&]", artist_str):
            name = name.strip()
            if name:
                external_artists_set.add(name)
    return {
        "artists": artists_data,
        "albums": albums_data or [],
        "artistsCount": len(artists_data),
        "albumsCount": len(albums_data or []),
        "externalArtists": list(external_artists_set),
    }


async def _fetch_explore():
    banners, recommendations, activities, charts = await asyncio.gather(
        fetch_table("explore_banners", {"select": "*", "is_active": "eq.true", "order": "sort_order.asc"}),
        fetch_table("explore_recommendations", {"select": "*", "is_active": "eq.true", "order": "sort_order.asc"}),
        fetch_table("explore_activities", {"select": "*", "is_active": "eq.true", "order": "sort_order.asc"}),
        fetch_table("explore_charts", {"select": "*", "is_active": "eq.true", "order": "sort_order.asc"}),
    )
    if banners is None or recommendations is None or activities is None or charts is None:
        return None
    return {
        "success": True,
        "data": {
            "banners": banners,
            "recommendations": recommendations,
            "activities": activities,
            "charts": charts,
        },
    }


async def _fetch_musicbrainz(artist_name: str):
    try:
        async with httpx.AsyncClient(timeout=300) as mb_client:  # 5分钟超时，MB同步可能需要较长时间
            resp = await mb_client.post(f"{app_base_url}/api/music/sync-mb?artistName={artist_name}")
            if resp.status_code == 200:
                return resp.json()
            print(f"[mb] sync-mb returned {resp.status_code} for {artist_name}")
    except Exception as e:
        print(f"[mb] fetch failed for {artist_name}: {e}")
    return None


def _run_mb_background(artist_name: str):
    async def _do():
        try:
            _mb_processing.add(artist_name)
            result = await _fetch_musicbrainz(artist_name)
            if result and result.get("success"):
                cache_key = f"mb:{artist_name}"
                cache.set(cache_key, result, 600)
                artist_info = result.get("artistInfo", {})
                print(
                    f"[MB Sync] 完成: artist={artist_name}, "
                    f"mbid={artist_info.get('musicbrainz_id', 'N/A')}, "
                    f"albums={result.get('albumsSynced', 0)}, "
                    f"tracks={result.get('tracksSynced', 0)}, "
                    f"rg_count={artist_info.get('totalReleaseGroups', 0)}, "
                    f"rec_count={artist_info.get('totalRecordings', 0)}, "
                    f"has_cover={artist_info.get('hasCoverArt', False)}"
                )
            _mb_processing.discard(artist_name)
        except Exception as e:
            logger.error(f"[MB Sync] 后台任务异常: artist={artist_name}, error={str(e)}")
            _mb_processing.discard(artist_name)
    threading.Thread(target=lambda: asyncio.run(_do()), daemon=True).start()


@app.get("/api/cache/tracks")
async def get_tracks(limit: int = 50, search: str = ""):
    cache_key = f"tracks:limit{limit}:search{search}"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_tracks_list(limit, search), 120)
        return cached

    data = await _fetch_tracks_list(limit, search)
    if data is not None:
        cache.set(cache_key, data, 120)
    return data if data is not None else []


async def _fetch_tracks_list(limit: int, search: str):
    params = {"select": "*", "order": "created_at.desc", "limit": str(limit)}
    if search:
        params["or"] = f"(title.ilike.*{search}*,artist.ilike.*{search}*,album.ilike.*{search}*)"
    return await fetch_table("tracks", params)


@app.get("/api/cache/external-tracks/search")
async def search_external_tracks(q: str = Query("", min_length=1)):
    cache_key = f"external-tracks:search:{q}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    data = await fetch_table(
        "external_playlist_tracks",
        {
            "select": "id,track_title,track_artist,track_duration,platform_track_id,playlist_id",
            "or": f"(track_title.ilike.*{q}*,track_artist.ilike.*{q}*)",
            "limit": "20",
        },
    )
    if data is not None:
        cache.set(cache_key, data, 300)
    return data if data is not None else []


@app.get("/api/cache/tracks/{track_id}")
async def get_track(track_id: int):
    cache_key = f"tracks:{track_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, fetch_single("tracks", {"id": f"eq.{track_id}"}), 120)
        return cached

    data = await fetch_single("tracks", {"id": f"eq.{track_id}"})
    if data is not None:
        cache.set(cache_key, data, 120)
    return data


@app.get("/api/cache/tracks/local")
async def get_local_tracks(page: int = 1, pageSize: int = 20, search: str = ""):
    cache_key = f"tracks:local:page{page}:size{pageSize}:search{search}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    offset = (page - 1) * pageSize
    params = {
        "select": "*",
        "or": "(source.eq.local,source.eq.upload)",
        "order": "created_at.desc",
        "limit": str(pageSize),
        "offset": str(offset),
    }
    if search:
        params["and"] = f"(or(title.ilike.*{search}*,artist.ilike.*{search}*,album.ilike.*{search}*))"

    count = await fetch_count("tracks", {"or": "(source.eq.local,source.eq.upload)"})
    data = await fetch_table("tracks", params)
    if data is None:
        data = []
    result = {
        "success": True,
        "data": data,
        "total": count,
        "page": page,
        "pageSize": pageSize,
        "totalPages": max(1, -(-count // pageSize)),
    }
    cache.set(cache_key, result, 120)
    return result


@app.get("/api/cache/playlists")
async def get_playlists():
    cache_key = "playlists"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_playlists(), 120)  # M2: 3600→120
        return cached

    data = await _fetch_playlists()
    if data is not None:
        cache.set(cache_key, data, 120)  # M2: 3600→120 与规则一致
        return data
    return {"local": [], "external": []}


async def _fetch_playlists():
    local_p, external_p = await asyncio.gather(
        fetch_table("playlists", {"select": "id,name,description,cover,is_public,platform_source,external_playlist_id,platform_playlist_id,track_count,created_at", "order": "created_at.desc"}),
        fetch_table("external_playlists", {"select": "id,name,cover_url,track_count,platform_id,platform_playlist_id,source,created_at", "order": "created_at.desc"}),
    )
    if local_p is None or external_p is None:
        return None
    return {"local": local_p, "external": external_p}


@app.get("/api/cache/playlists/{playlist_id}/tracks")
async def get_playlist_tracks(playlist_id: str, source: str = "local"):
    cache_key = f"playlists:{playlist_id}:tracks:{source}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    if source == "external":
        data = await fetch_table(
            "external_playlist_tracks",
            {
                "select": "id,track_title,track_artist,track_duration,platform_track_id,position",
                "playlist_id": f"eq.{playlist_id}",
                "order": "position.asc",
            },
        )
    else:
        data = await fetch_table(
            "playlist_tracks",
            {
                "select": "position,tracks(id,title,artist,album,cover,duration,source,play_url,audio_url,lyrics,mv_url,mv_cover,created_at)",
                "playlist_id": f"eq.{playlist_id}",
                "order": "position.asc",
            },
        )
    if data is not None:
        cache.set(cache_key, data, 600)
    return data if data is not None else []


@app.get("/api/cache/artists")
async def get_artists():
    cache_key = "artists"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_artists(), 300)
        return cached

    data = await _fetch_artists()
    if data is not None:
        cache.set(cache_key, data, 300)
        return data
    return {"artists": [], "albums": [], "artistsCount": 0, "albumsCount": 0}


@app.get("/api/cache/artists/{artist_id}")
async def get_artist_detail(artist_id: str):
    cache_key = f"artist:{artist_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_artist_detail(artist_id), 300)
        return cached
    data = await _fetch_artist_detail(artist_id)
    if data is None:
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": "Artist not found"}, status_code=404)
    cache.set(cache_key, data, 300)
    return data


async def _fetch_artist_detail(artist_id: str):
    artists_data = await fetch_table("artists", {"select": "*", "id": f"eq.{artist_id}"})
    if not artists_data:
        return None
    artist = artists_data[0]
    tracks_data = await fetch_table("tracks", {"select": "*", "artist": f"ilike.*{artist['name']}*"})
    albums_data = await fetch_table("albums", {"select": "*", "artist": f"ilike.*{artist['name']}*"})
    return {
        "artist": artist,
        "tracks": tracks_data or [],
        "albums": albums_data or [],
        "trackCount": len(tracks_data or []),
        "albumCount": len(albums_data or []),
    }


@app.get("/api/cache/explore")
async def get_explore():
    cache_key = "explore"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_explore(), 600)
        return cached

    data = await _fetch_explore()
    if data is not None:
        cache.set(cache_key, data, 600)
    return data


@app.post("/api/cache/musicbrainz/{artist_name}")
async def trigger_musicbrainz_sync(artist_name: str):
    if artist_name in _mb_processing:
        return {"status": "processing", "message": "同步进行中"}
    cache_key = f"mb:{artist_name}"
    cached = cache.get(cache_key)
    if cached is not None:
        return {**cached, "status": "cached"}
    _run_mb_background(artist_name)
    return {"status": "processing", "message": "已开始同步"}


@app.get("/api/cache/musicbrainz/{artist_name}")
async def get_musicbrainz_data(artist_name: str):
    if artist_name in _mb_processing:
        return {"status": "processing", "message": "同步进行中"}
    cache_key = f"mb:{artist_name}"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_musicbrainz(artist_name))
        return {**cached, "status": "ok"}
    data = await _fetch_musicbrainz(artist_name)
    if data is not None:
        cache.set(cache_key, data, 600)
        return {**data, "status": "ok"}
    from fastapi.responses import JSONResponse
    return JSONResponse({"status": "error", "error": "No data"}, status_code=404)


# 网易云歌手同步缓存
_netease_processing: set[str] = set()


async def _fetch_netease_artist(artist_name: str):
    """调用Next.js API获取网易云歌手数据"""
    async with httpx.AsyncClient(timeout=300) as client:
        try:
            resp = await client.post(
                f"{app_base_url}/api/music/sync-netease-artist?artistName={artist_name}",
            )
            return resp.json()
        except Exception as e:
            print(f"[Netease] API调用失败: {e}")
            return None


def _run_netease_background(artist_name: str):
    """后台执行网易云同步"""
    async def _do():
        try:
            _netease_processing.add(artist_name)
            result = await _fetch_netease_artist(artist_name)
            if result and result.get("success"):
                cache.set(f"netease:artist:{artist_name}", result, 3600)
                print(
                    f"[Netease] 缓存成功: {artist_name}, "
                    f"albums={result.get('data',{}).get('albumsSynced',0)}, "
                    f"tracks={result.get('data',{}).get('tracksSynced',0)}"
                )
            _netease_processing.discard(artist_name)
        except Exception as e:
            print(f"[Netease] 后台任务异常: artist={artist_name}, error={str(e)}")
            _netease_processing.discard(artist_name)
    threading.Thread(target=lambda: asyncio.run(_do()), daemon=True).start()


@app.post("/api/cache/netease-artist/{artist_name}")
async def trigger_netease_sync(artist_name: str):
    """触发网易云歌手同步"""
    cache_key = f"netease:artist:{artist_name}"
    cached = cache.get(cache_key)

    if cached:
        return {**cached, "status": "cached"}

    if artist_name in _netease_processing:
        return {"status": "processing"}

    _run_netease_background(artist_name)
    return {"status": "processing"}


@app.get("/api/cache/netease-artist/{artist_name}")
async def get_netease_sync(artist_name: str):
    """获取网易云同步状态"""
    cache_key = f"netease:artist:{artist_name}"
    cached = cache.get(cache_key)

    if cached:
        return {**cached, "status": "ok"}

    if artist_name in _netease_processing:
        return {"status": "processing"}

    return {"status": "not_found"}


@app.get("/api/cache/comments")
async def get_comments(target_type: str = Query(...), target_id: str = Query(...)):
    cache_key = f"comments:{target_type}:{target_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    data = await fetch_table(
        "comments",
        {
            "select": "*",
            "target_type": f"eq.{target_type}",
            "target_id": f"eq.{target_id}",
            "is_deleted": "eq.false",
            "order": "created_at.desc",
        },
    )
    if data is None:
        return []

    # 批量查询评论用户的头像 URL
    user_ids = list({c.get("user_id") for c in data if c.get("user_id")})
    if user_ids:
        users_data = await fetch_table(
            "users",
            {"select": "id,avatar_url", "id": f"in.({','.join(user_ids)})"},
        )
        if users_data:
            avatar_map = {u["id"]: u.get("avatar_url") for u in users_data if u.get("avatar_url")}
            for c in data:
                c["avatar_url"] = avatar_map.get(c.get("user_id"))

    cache.set(cache_key, data, 60)
    return data


@app.get("/api/cache/rhythm/songs")
async def get_rhythm_songs():
    cache_key = "rhythm:songs"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    tracks_data, charts_data = await asyncio.gather(
        fetch_table("tracks", {"select": "*", "order": "created_at.desc"}),
        fetch_table("rhythm_charts", {"select": "track_id,difficulty"}),
    )
    if tracks_data is None:
        return []

    chart_map = {}
    if charts_data:
        for chart in charts_data:
            tid = chart.get("track_id")
            if tid not in chart_map:
                chart_map[tid] = []
            chart_map[tid].append(chart.get("difficulty"))

    songs = []
    for track in tracks_data:
        difficulties = chart_map.get(track.get("id"), [])
        songs.append({
            "id": track.get("id"),
            "name": track.get("title"),
            "artist": track.get("artist"),
            "duration": track.get("duration"),
            "audio_url": track.get("audio_url"),
            "cover_url": track.get("cover"),
            "bpm": track.get("bpm"),
            "has_chart": len(difficulties) > 0,
            "chart_difficulties": difficulties,
        })

    cache.set(cache_key, songs, 300)
    return songs


@app.get("/api/cache/rhythm/charts/{track_id}")
async def get_rhythm_charts(track_id: int, difficulty: str = "normal"):
    cache_key = f"rhythm:charts:{track_id}:{difficulty}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    params = {
        "select": "*",
        "track_id": f"eq.{track_id}",
    }
    if difficulty:
        params["difficulty"] = f"eq.{difficulty}"

    data = await fetch_table("rhythm_charts", params)
    if data is None:
        return None
    result = data[0] if data else None
    cache.set(cache_key, result, 600)
    return result


@app.get("/api/cache/stats/tracks")
async def get_stats_tracks(filter: str = "all"):
    cache_key = f"stats:tracks:{filter}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    params = {
        "select": "id,track_title,track_artist,track_duration,platform_track_id,position,play_count,last_played_at,created_at,playlist:external_playlists(id,name,cover_url,platform:external_platforms(platform))",
        "play_count": "gt.0",
        "order": "play_count.desc.nullslast",
        "limit": "100",
    }
    if filter == "week":
        from datetime import datetime, timedelta
        one_week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
        params["last_played_at"] = f"gte.{one_week_ago}"

    data = await fetch_table("external_playlist_tracks", params)
    if data is None:
        return {"success": True, "data": [], "count": 0}

    formatted = []
    for i, track in enumerate(data):
        formatted.append({
            "id": track.get("id"),
            "title": track.get("track_title"),
            "artist": track.get("track_artist"),
            "duration": track.get("track_duration"),
            "platform_track_id": track.get("platform_track_id"),
            "position": track.get("position") or i + 1,
            "playCount": track.get("play_count") or 0,
            "lastPlayedAt": track.get("last_played_at"),
            "createdAt": track.get("created_at"),
            "cover": track.get("playlist", {}).get("cover_url") if isinstance(track.get("playlist"), dict) else None,
            "playlistName": track.get("playlist", {}).get("name") if isinstance(track.get("playlist"), dict) else "未知歌单",
            "platform": track.get("playlist", {}).get("platform", {}).get("platform") if isinstance(track.get("playlist", {}).get("platform"), dict) else "netease",
        })

    result = {"success": True, "data": formatted, "count": len(formatted)}
    cache.set(cache_key, result, 120)
    return result


@app.get("/api/cache/forbidden-words")
async def get_forbidden_words():
    cache_key = "forbidden-words"
    cached = cache.get(cache_key)
    if cached is not None:
        return {"words": cached}

    data = await fetch_table("forbidden_words", {"select": "word"})
    words = [item["word"] for item in data] if data else []
    if words:
        cache.set(cache_key, words, 60)
    return {"words": words}


@app.post("/api/cache/forbidden-words/invalidate")
async def invalidate_forbidden_words():
    cache.invalidate("forbidden-words")
    return {"status": "ok"}


@app.get("/api/cache/admin/stats")
async def get_admin_stats():
    cache_key = "admin:stats"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_admin_stats(), 300)
        return cached

    data = await _fetch_admin_stats()
    if data is not None:
        cache.set(cache_key, data, 300)
        return data
    return {"users": 0, "artists": 0, "tracks": 0, "playlists": 0, "localPlaylists": 0, "externalPlaylists": 0, "favorites": 0, "playlistFavorites": 0, "recentComments": []}


@app.get("/api/cache/admin/playlists/all")
async def get_admin_playlists_all():
    cache_key = "admin:playlists:all"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_admin_playlists(), 300)
        return cached

    data = await _fetch_admin_playlists()
    if data is not None:
        cache.set(cache_key, data, 300)
        return data
    return {"local": [], "external": []}


@app.get("/api/cache/admin/albums/all")
async def get_admin_albums_all(page: int = 1, limit: int = 50, search: str = ""):
    """专辑管理聚合端点：一次返回专辑列表 + 每个专辑的歌曲数，避免 N+1 查询"""
    cache_key = f"admin:albums:all:page{page}:limit{limit}:search{search}"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_admin_albums_aggregate(page, limit, search), 300)
        return cached

    data = await _fetch_admin_albums_aggregate(page, limit, search)
    if data is not None:
        cache.set(cache_key, data, 300)
        return data
    return {"data": [], "pagination": {"page": page, "limit": limit, "total": 0, "totalPages": 1}}


@app.get("/api/cache/admin/{table}")
async def get_admin_table(table: str, page: int = 1, limit: int = 50, search: str = ""):
    valid_tables = {"users", "artists", "tracks", "playlists", "external_playlists", "comments", "albums"}
    if table not in valid_tables:
        return {"error": f"Invalid table: {table}"}

    cache_key = f"admin:{table}:page{page}:limit{limit}:search{search}"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_admin_table(table, page, limit, search), 300)
        return cached

    data = await _fetch_admin_table(table, page, limit, search)
    if data is not None:
        cache.set(cache_key, data, 300)
        return data
    return {"data": [], "pagination": {"page": page, "limit": limit, "total": 0, "totalPages": 1}}


@app.get("/api/cache/home/aggregate")
async def get_home_aggregate():
    cache_key = "home:aggregate"
    cached = cache.get(cache_key)
    if cached is not None:
        if cache.is_expired(cache_key):
            bg_refresh(cache_key, _fetch_home_aggregate(), 120)
        return cached

    data = await _fetch_home_aggregate()
    if data is not None:
        cache.set(cache_key, data, 120)
        return data
    return {"tracks": [], "localPlaylists": [], "externalPlaylists": [], "artists": [], "albums": []}


class InvalidateRequest(BaseModel):
    keys: list[str]


@app.post("/api/cache/invalidate")
async def invalidate_cache(body: InvalidateRequest):
    results = {}
    for key in body.keys:
        results[key] = cache.invalidate(key)
        if key in ("artists", "playlists", "tracks", "home"):
            for k in list(cache._store.keys()):
                if k.startswith("artist:") or k.startswith("admin:playlists") or k.startswith("admin:stats") or k.startswith("home:"):
                    cache.invalidate(k)
    return {"invalidated": results}


@app.post("/api/cache/invalidate/all")
async def invalidate_all_cache():
    count = cache.invalidate_all()
    return {"cleared": count}


@app.get("/api/cache/stats")
async def get_cache_stats():
    return cache.stats()


@app.get("/api/cache/health")
async def get_health():
    healthy = await health_check()
    return {
        "status": "healthy" if healthy else "degraded",
        "offline_mode": cache._offline_mode,
        "consecutive_errors": _consecutive_errors,
        "cache_entries": len(cache._store),
        "client_status": "connected" if client and not client.is_closed else "disconnected",
    }


@app.get("/api/cache/stress-test")
async def stress_test(concurrent: int = 10, iterations: int = 5, mode: str = "cache-first"):
    import time as _time2
    results = {"total_requests": concurrent * iterations, "success": 0, "failures": 0, "avg_ms": 0, "min_ms": 99999, "max_ms": 0, "errors": [], "cache_hits": 0}

    async def _cached_request():
        nonlocal results
        start = _time2.time()
        try:
            cache_key = "playlists"
            cached = cache.get(cache_key)
            elapsed = (_time2.time() - start) * 1000
            
            if cached is not None:
                results["success"] += 1
                results["cache_hits"] += 1
                results["avg_ms"] += elapsed
                results["min_ms"] = min(results["min_ms"], elapsed)
                results["max_ms"] = max(results["max_ms"], elapsed)
            else:
                data = await _fetch_playlists()
                elapsed = (_time2.time() - start) * 1000
                if data is not None:
                    results["success"] += 1
                    results["avg_ms"] += elapsed
                    results["min_ms"] = min(results["min_ms"], elapsed)
                    results["max_ms"] = max(results["max_ms"], elapsed)
                else:
                    results["failures"] += 1
                    results["errors"].append("null_data")
        except Exception as e:
            results["failures"] += 1
            results["errors"].append(str(e)[:50])

    async def _direct_request():
        nonlocal results
        start = _time2.time()
        try:
            data = await _fetch_playlists()
            elapsed = (_time2.time() - start) * 1000
            if data is not None:
                results["success"] += 1
                results["avg_ms"] += elapsed
                results["min_ms"] = min(results["min_ms"], elapsed)
                results["max_ms"] = max(results["max_ms"], elapsed)
            else:
                results["failures"] += 1
                results["errors"].append("null_data")
        except Exception as e:
            results["failures"] += 1
            results["errors"].append(str(e)[:50])

    _request_fn = _cached_request if mode == "cache-first" else _direct_request
    
    tasks = []
    for _ in range(concurrent):
        for _ in range(iterations):
            tasks.append(_request_fn())
    
    await asyncio.gather(*tasks)
    
    if results["success"] > 0:
        results["avg_ms"] = round(results["avg_ms"] / results["success"], 2)
    if results["min_ms"] == 99999:
        results["min_ms"] = 0
    
    return {
        "test_type": f"playlist_stress_{mode}",
        "config": {"concurrent": concurrent, "iterations": iterations, "mode": mode},
        **results,
        "hit_rate": f"{round(results['cache_hits'] / max(1, results['total_requests']) * 100)}%" if mode == "cache-first" else "N/A",
        "cache_entries_before": len(cache._store),
        "timestamp": _time2.time(),
    }
