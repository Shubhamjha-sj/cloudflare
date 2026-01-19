-- Signal Platform D1 Database Schema
-- Migration 001: Initial Schema

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('github', 'discord', 'twitter', 'support', 'forum', 'email')),
    sentiment REAL DEFAULT 0.0,
    sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'neutral', 'negative', 'frustrated', 'concerned', 'annoyed')),
    urgency INTEGER DEFAULT 5 CHECK (urgency >= 1 AND urgency <= 10),
    product TEXT,
    themes TEXT DEFAULT '[]',  -- JSON array stored as text
    customer_id TEXT,
    customer_name TEXT,
    customer_tier TEXT CHECK (customer_tier IN ('enterprise', 'pro', 'free', 'unknown')),
    customer_arr INTEGER DEFAULT 0,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'acknowledged', 'in_progress', 'resolved', 'closed')),
    assigned_to TEXT,
    metadata TEXT DEFAULT '{}',  -- JSON object stored as text
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('enterprise', 'pro', 'free', 'unknown')),
    arr INTEGER DEFAULT 0,
    products TEXT DEFAULT '[]',  -- JSON array stored as text
    health_score REAL DEFAULT 0.5,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('critical', 'warning', 'info')),
    message TEXT NOT NULL,
    product TEXT,
    acknowledged INTEGER DEFAULT 0,
    feedback_ids TEXT DEFAULT '[]',  -- JSON array stored as text
    created_at TEXT DEFAULT (datetime('now'))
);

-- Themes table
CREATE TABLE IF NOT EXISTS themes (
    id TEXT PRIMARY KEY,
    theme TEXT NOT NULL,
    mentions INTEGER DEFAULT 0,
    sentiment TEXT,
    products TEXT DEFAULT '[]',  -- JSON array stored as text
    is_new INTEGER DEFAULT 1,
    summary TEXT,
    suggested_action TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Feature requests table
CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    request_count INTEGER DEFAULT 1,
    top_use_cases TEXT DEFAULT '[]',  -- JSON array
    customer_profile TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'planned', 'in_progress', 'shipped', 'declined')),
    product TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Chat conversations table (for persistence)
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    messages TEXT DEFAULT '[]',  -- JSON array of messages
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source);
CREATE INDEX IF NOT EXISTS idx_feedback_product ON feedback(product);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_customer_id ON feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_customer_tier ON feedback(customer_tier);
CREATE INDEX IF NOT EXISTS idx_feedback_urgency ON feedback(urgency);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(sentiment);

CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
CREATE INDEX IF NOT EXISTS idx_customers_arr ON customers(arr);

CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_product ON alerts(product);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_themes_mentions ON themes(mentions);
CREATE INDEX IF NOT EXISTS idx_themes_is_new ON themes(is_new);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS feedback_updated_at
    AFTER UPDATE ON feedback
    BEGIN
        UPDATE feedback SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS customers_updated_at
    AFTER UPDATE ON customers
    BEGIN
        UPDATE customers SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS themes_updated_at
    AFTER UPDATE ON themes
    BEGIN
        UPDATE themes SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
