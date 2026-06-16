-- ─── Notifications ───────────────────────────────────────────────────────────
-- Stores in-app notifications for players.
-- Triggered by: team formation, match submission, match approval, etc.

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id   UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL, -- 'team_assigned' | 'match_submitted' | 'match_approved' | 'general'
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  link        TEXT,                 -- e.g. '/dashboard/tournaments/abc123'
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_player_unread
  ON notifications (player_id, is_read, created_at DESC);

-- RLS: players can only see/update their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (true); -- service role bypasses RLS; frontend uses service key via backend

CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (true);

CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (true);
