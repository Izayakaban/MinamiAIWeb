-- MinamiAI schema
-- Target: PostgreSQL 14+
-- Apply with: psql "$DATABASE_URL" -f migrations/001_init.sql
--
-- These four tables back the application: the interactive chat window,
-- TTS playback, the animated avatar, and cross-session memory.
--
-- This script is idempotent at the object level (IF NOT EXISTS everywhere),
-- so it is safe to re-run against a database that is already partially built.

BEGIN;

-- ---------------------------------------------------------------------------
-- users
-- Root of every ownership chain. Deleting a user removes their entire
-- footprint by cascade, which is the intended privacy behaviour.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT users_role_valid
        CHECK (role IN ('user', 'admin')),
    CONSTRAINT users_username_shape
        CHECK (username ~ '^[A-Za-z0-9_]{3,32}$')
);

-- Case-insensitive uniqueness: 'Izaya' and 'izaya' must not both exist.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
    ON users (LOWER(username));

-- ---------------------------------------------------------------------------
-- conversations
-- One chat session. Sits between users and messages so a session can be
-- listed and titled independently, and so transcript reads are scoped.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(120),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Drives the "recent conversations" sidebar.
CREATE INDEX IF NOT EXISTS conversations_user_recent_idx
    ON conversations (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- messages
-- The transcript. One row per turn. Read ordered by created_at ascending
-- to rebuild the message array for the model call.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER     NOT NULL
        REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(16) NOT NULL,
    content         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_role_valid
        CHECK (role IN ('user', 'assistant')),
    CONSTRAINT messages_content_nonempty
        CHECK (LENGTH(TRIM(content)) > 0)
);

-- The hot path. Without this, every chat turn sequentially scans the table.
CREATE INDEX IF NOT EXISTS messages_conversation_order_idx
    ON messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- memories
-- Long-term facts extracted from conversation in a background pass.
-- Deliberately owned by the USER, not the conversation, so they outlive the
-- session that produced them. This is what lets Minami recall something the
-- user mentioned in an earlier session.
--
-- Expiry invariant: importance 5 is permanent (expires_at IS NULL);
-- every lower tier must carry an expiry. Enforced by CHECK so a buggy
-- extraction pass cannot quietly write an immortal tier-1 memory.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memories (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER     NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    source_message_id INTEGER
        REFERENCES messages(id) ON DELETE SET NULL,
    content           TEXT        NOT NULL,
    importance        SMALLINT    NOT NULL,
    expires_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT memories_importance_range
        CHECK (importance BETWEEN 1 AND 5),
    CONSTRAINT memories_content_nonempty
        CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT memories_expiry_matches_tier
        CHECK (
            (importance = 5 AND expires_at IS NULL)
            OR
            (importance < 5 AND expires_at IS NOT NULL)
        )
);

-- Retrieval path: highest-importance live memories for one user.
CREATE INDEX IF NOT EXISTS memories_user_importance_idx
    ON memories (user_id, importance DESC, created_at DESC);

-- Cleanup path: only rows that can ever expire.
CREATE INDEX IF NOT EXISTS memories_expiry_idx
    ON memories (expires_at)
    WHERE expires_at IS NOT NULL;

-- Supports the ON DELETE SET NULL sweep and the admin panel's
-- "trace this memory back to its message" view.
CREATE INDEX IF NOT EXISTS memories_source_message_idx
    ON memories (source_message_id)
    WHERE source_message_id IS NOT NULL;

COMMIT;


-- ---------------------------------------------------------------------------
-- Reference queries
-- Not part of the migration. Kept here as the canonical shape of the
-- queries that matter for performance, so the indexes above have an
-- obvious justification.
-- ---------------------------------------------------------------------------

-- 1. Rebuild transcript for a model call (uses messages_conversation_order_idx)
--
--    SELECT role, content
--      FROM messages
--     WHERE conversation_id = $1
--     ORDER BY created_at ASC;

-- 2. Retrieve live long-term memories (uses memories_user_importance_idx)
--
--    SELECT content, importance
--      FROM memories
--     WHERE user_id = $1
--       AND (expires_at IS NULL OR expires_at > NOW())
--     ORDER BY importance DESC, created_at DESC
--     LIMIT 20;

-- 3. Prune expired memories (uses memories_expiry_idx; run on a schedule)
--
--    DELETE FROM memories
--     WHERE expires_at IS NOT NULL
--       AND expires_at <= NOW();
