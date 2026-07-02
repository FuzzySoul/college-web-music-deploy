import { pgTable, serial, integer, bigint, varchar, timestamp, text, boolean, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const favorites = pgTable("favorites", {
	id: serial().notNull(),
	trackId: integer("track_id").notNull(),
	userId: varchar("user_id", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const playlistFavorites = pgTable("playlist_favorites", {
	id: serial().notNull(),
	playlistId: varchar("playlist_id", { length: 255 }).notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const playHistory = pgTable("play_history", {
	id: serial().notNull(),
	trackId: integer("track_id").notNull(),
	userId: varchar("user_id", { length: 255 }),
	playedAt: timestamp("played_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	durationPlayed: integer("duration_played").default(0),
});

export const playlistTracks = pgTable("playlist_tracks", {
	id: serial().notNull(),
	playlistId: integer("playlist_id").notNull(),
	trackId: integer("track_id").notNull(),
	position: integer().default(0),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const playlists = pgTable("playlists", {
	id: serial().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	cover: text(),
	userId: varchar("user_id", { length: 255 }),
	isPublic: boolean("is_public").default(true),
	platformSource: varchar("platform_source", { length: 50 }),
	externalPlaylistId: integer("external_playlist_id"),
	platformPlaylistId: varchar("platform_playlist_id", { length: 255 }),
	trackCount: integer("track_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const externalPlaylists = pgTable("external_playlists", {
	id: serial().notNull(),
	platformId: integer("platform_id").notNull(),
	platformPlaylistId: varchar("platform_playlist_id", { length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	coverUrl: text("cover_url"),
	trackCount: integer("track_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const externalPlaylistTracks = pgTable("external_playlist_tracks", {
	id: serial().notNull(),
	playlistId: integer("playlist_id").notNull(),
	trackTitle: varchar("track_title", { length: 500 }).notNull(),
	trackArtist: varchar("track_artist", { length: 500 }),
	trackDuration: integer("track_duration"),
	platformTrackId: varchar("platform_track_id", { length: 255 }),
	position: integer().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const tracks = pgTable("tracks", {
	id: serial().notNull(),
	title: varchar({ length: 255 }).notNull(),
	artist: varchar({ length: 255 }).notNull(),
	album: varchar({ length: 255 }),
	cover: text(),
	duration: integer().default(0),
	source: varchar({ length: 50 }).default('local'),
	sourceId: varchar("source_id", { length: 255 }),
	playUrl: text("play_url"),
	audioUrl: text("audio_url"),
	bpm: integer(),
	hasChart: boolean("has_chart").default(false),
	chartDifficulties: text("chart_difficulties"),
	lyrics: text("lyrics"),
	mvUrl: text("mv_url"),
	mvCover: text("mv_cover"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const rhythmCharts = pgTable("rhythm_charts", {
	id: serial().notNull(),
	trackId: integer("track_id").notNull(),
	difficulty: varchar({ length: 50 }).notNull(),
	noteSpeed: integer("note_speed"),
	judgmentWindow: integer("judgment_window"),
	notes: jsonb().$type<{ time: number; lane: number }[]>(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const externalPlatforms = pgTable("external_platforms", {
	id: serial().notNull(),
	platform: varchar({ length: 50 }).notNull(),
	platformUserId: varchar("platform_user_id", { length: 255 }),
	nickname: varchar({ length: 255 }),
	avatarUrl: text("avatar_url"),
	cookie: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const artists = pgTable("artists", {
	id: varchar("id", { length: 36 }).primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	alias: varchar({ length: 255 }),
	image: text(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	musicbrainzId: varchar("musicbrainz_id", { length: 36 }),
	mbSyncedAt: timestamp("mb_synced_at"),
});

export const albums = pgTable("albums", {
	id: serial().notNull(),
	name: varchar({ length: 255 }).notNull(),
	artist: varchar({ length: 255 }),
	coverUrl: text("cover_url"),
	trackCount: integer("track_count").default(0),
	year: integer(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const forbiddenWords = pgTable("forbidden_words", {
	id: serial().notNull(),
	word: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const comments = pgTable("comments", {
	id: serial().notNull(),
	content: text().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	username: varchar({ length: 255 }).notNull(),
	targetType: varchar("target_type", { length: 50 }).notNull(),
	targetId: text("target_id").notNull(),
	parentId: text("parent_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isDeleted: boolean("is_deleted").default(false),
});
