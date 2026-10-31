CREATE TABLE uno_admin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE uno_admin_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE uno_room_history (id TEXT PRIMARY KEY, name TEXT NOT NULL, scope TEXT NOT NULL, mode TEXT NOT NULL, rules TEXT NOT NULL, phase TEXT NOT NULL, round INTEGER NOT NULL, participants_json TEXT NOT NULL, players_json TEXT NOT NULL, report_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX uno_room_history_updated ON uno_room_history(scope, updated_at DESC);
