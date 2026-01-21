-- Seed Data: Dummy feedback for past 90 days
-- Run with: npx wrangler d1 execute signal-db --remote --file=./migrations/002_seed_data.sql

-- ============================================
-- Customers
-- ============================================
INSERT INTO customers (id, name, email, tier, arr, products, health_score) VALUES
('cust_001', 'Acme Corp', 'contact@acme.com', 'enterprise', 250000, '["Workers", "R2", "D1"]', 0.85),
('cust_002', 'TechStart Inc', 'hello@techstart.io', 'pro', 12000, '["Workers", "Pages"]', 0.72),
('cust_003', 'DataFlow Systems', 'support@dataflow.com', 'enterprise', 180000, '["Workers", "Vectorize", "AI"]', 0.91),
('cust_004', 'CloudNine Apps', 'team@cloudnine.dev', 'pro', 8500, '["Pages", "Workers"]', 0.68),
('cust_005', 'DevOps Masters', 'info@devopsmasters.com', 'enterprise', 320000, '["Workers", "Queues", "D1", "R2"]', 0.78),
('cust_006', 'StartupXYZ', 'founders@startupxyz.com', 'free', 0, '["Pages"]', 0.45),
('cust_007', 'Enterprise Solutions Ltd', 'enterprise@esolutions.co', 'enterprise', 450000, '["Workers", "R2", "D1", "Vectorize"]', 0.88),
('cust_008', 'InnovateTech', 'hello@innovatetech.io', 'pro', 15000, '["Workers", "AI"]', 0.75),
('cust_009', 'GlobalRetail', 'tech@globalretail.com', 'enterprise', 280000, '["Workers", "R2", "CDN"]', 0.82),
('cust_010', 'SmallBiz Co', 'owner@smallbiz.co', 'free', 0, '["Pages", "Workers"]', 0.55);

-- ============================================
-- Feedback - Last 90 days (various sources)
-- ============================================

-- Critical Issues (High Urgency)
INSERT INTO feedback (id, content, source, sentiment, sentiment_label, urgency, product, themes, customer_id, customer_name, customer_tier, customer_arr, status, created_at) VALUES
('fb_001', 'Workers deployment failing with timeout errors in production. Our entire API is down affecting 50k users. Need immediate assistance!', 'support', -0.9, 'frustrated', 10, 'Workers', '["deployment", "timeout", "outage"]', 'cust_001', 'Acme Corp', 'enterprise', 250000, 'in_progress', datetime('now', '-2 hours')),
('fb_002', 'D1 database queries returning 500 errors intermittently. This is blocking our product launch scheduled for tomorrow.', 'support', -0.85, 'frustrated', 9, 'D1', '["database", "errors", "reliability"]', 'cust_005', 'DevOps Masters', 'enterprise', 320000, 'in_review', datetime('now', '-5 hours')),
('fb_003', 'R2 bucket access suddenly denied after working fine for months. Production images not loading. Critical for our e-commerce site!', 'support', -0.8, 'frustrated', 10, 'R2', '["access denied", "permissions", "outage"]', 'cust_009', 'GlobalRetail', 'enterprise', 280000, 'new', datetime('now', '-1 day')),

-- Recent Issues (Past Week)
('fb_004', 'The new Workers AI feature is amazing but documentation is lacking. Took me 3 hours to figure out streaming responses.', 'discord', -0.2, 'concerned', 5, 'Workers AI', '["documentation", "streaming", "DX"]', 'cust_008', 'InnovateTech', 'pro', 15000, 'new', datetime('now', '-1 day')),
('fb_005', 'Pages build times have increased significantly after the last update. What used to take 30s now takes 2+ minutes.', 'github', -0.4, 'annoyed', 7, 'Pages', '["performance", "build times", "regression"]', 'cust_004', 'CloudNine Apps', 'pro', 8500, 'new', datetime('now', '-2 days')),
('fb_006', 'Love the new D1 export feature! Finally can do proper backups. Any plans for scheduled automatic backups?', 'twitter', 0.7, 'positive', 3, 'D1', '["feature request", "backups", "export"]', 'cust_003', 'DataFlow Systems', 'enterprise', 180000, 'acknowledged', datetime('now', '-2 days')),
('fb_007', 'Vectorize is perfect for our RAG application. Query latency is incredible. Would love to see larger dimension support.', 'discord', 0.8, 'positive', 4, 'Vectorize', '["performance", "feature request", "RAG"]', 'cust_003', 'DataFlow Systems', 'enterprise', 180000, 'acknowledged', datetime('now', '-3 days')),
('fb_008', 'Getting rate limited on Workers AI even though we are well under our quota. Dashboard shows only 20% usage.', 'support', -0.5, 'concerned', 8, 'Workers AI', '["rate limiting", "quota", "billing"]', 'cust_007', 'Enterprise Solutions Ltd', 'enterprise', 450000, 'in_review', datetime('now', '-3 days')),
('fb_009', 'The wrangler CLI keeps crashing on Windows with the latest update. Had to downgrade to continue working.', 'github', -0.6, 'annoyed', 6, 'Wrangler', '["CLI", "Windows", "bug"]', 'cust_002', 'TechStart Inc', 'pro', 12000, 'new', datetime('now', '-4 days')),
('fb_010', 'Queues documentation example doesnt work. The consumer binding syntax has changed but docs werent updated.', 'discord', -0.3, 'concerned', 5, 'Queues', '["documentation", "examples", "DX"]', 'cust_005', 'DevOps Masters', 'enterprise', 320000, 'new', datetime('now', '-4 days')),

-- Past 2 Weeks
('fb_011', 'Successfully migrated from AWS Lambda to Workers. 60% cost reduction and better performance. Great product!', 'twitter', 0.9, 'positive', 2, 'Workers', '["migration", "cost savings", "testimonial"]', 'cust_001', 'Acme Corp', 'enterprise', 250000, 'closed', datetime('now', '-8 days')),
('fb_012', 'R2 multipart upload fails silently when file exceeds 5GB. No error message, just hangs. Took hours to debug.', 'github', -0.5, 'annoyed', 7, 'R2', '["multipart upload", "error handling", "UX"]', 'cust_009', 'GlobalRetail', 'enterprise', 280000, 'in_progress', datetime('now', '-9 days')),
('fb_013', 'When will Hyperdrive support MySQL? Our entire stack is MySQL and we really want to use it.', 'forum', 0.1, 'neutral', 4, 'Hyperdrive', '["feature request", "MySQL", "database"]', 'cust_004', 'CloudNine Apps', 'pro', 8500, 'acknowledged', datetime('now', '-10 days')),
('fb_014', 'Pages preview deployments are a game changer for our PR workflow. Team productivity increased significantly.', 'twitter', 0.85, 'positive', 2, 'Pages', '["preview deployments", "workflow", "testimonial"]', 'cust_002', 'TechStart Inc', 'pro', 12000, 'closed', datetime('now', '-11 days')),
('fb_015', 'D1 row limits are too restrictive for our analytics use case. Need to split queries which adds latency.', 'discord', -0.3, 'concerned', 6, 'D1', '["limits", "analytics", "performance"]', 'cust_007', 'Enterprise Solutions Ltd', 'enterprise', 450000, 'acknowledged', datetime('now', '-12 days')),

-- Past Month
('fb_016', 'Workers KV eventually consistent reads causing issues in our auth flow. Users sometimes see stale tokens.', 'support', -0.6, 'concerned', 8, 'KV', '["consistency", "auth", "reliability"]', 'cust_005', 'DevOps Masters', 'enterprise', 320000, 'in_progress', datetime('now', '-18 days')),
('fb_017', 'The new AI Gateway analytics are exactly what we needed. Can finally track model usage and costs properly.', 'twitter', 0.75, 'positive', 3, 'AI Gateway', '["analytics", "cost tracking", "feature"]', 'cust_003', 'DataFlow Systems', 'enterprise', 180000, 'closed', datetime('now', '-20 days')),
('fb_018', 'Confused about pricing for Workers AI. The free tier limits arent clear on the pricing page.', 'discord', -0.2, 'concerned', 4, 'Workers AI', '["pricing", "documentation", "free tier"]', 'cust_006', 'StartupXYZ', 'free', 0, 'acknowledged', datetime('now', '-22 days')),
('fb_019', 'Would love to see Python support in Workers. TypeScript is great but our team is stronger in Python.', 'forum', 0.2, 'neutral', 5, 'Workers', '["feature request", "Python", "languages"]', 'cust_010', 'SmallBiz Co', 'free', 0, 'acknowledged', datetime('now', '-25 days')),
('fb_020', 'Pages Functions cold start times are too long. First request takes 2-3 seconds which hurts UX.', 'github', -0.4, 'annoyed', 7, 'Pages', '["cold start", "performance", "Functions"]', 'cust_008', 'InnovateTech', 'pro', 15000, 'in_review', datetime('now', '-28 days')),

-- Past 2 Months
('fb_021', 'R2 egress costs are very competitive. Saved us $15k/month compared to S3. Keep up the good work!', 'twitter', 0.95, 'positive', 1, 'R2', '["pricing", "cost savings", "testimonial"]', 'cust_009', 'GlobalRetail', 'enterprise', 280000, 'closed', datetime('now', '-35 days')),
('fb_022', 'Durable Objects state sometimes gets corrupted after hibernation. Lost user session data twice this month.', 'support', -0.7, 'frustrated', 9, 'Durable Objects', '["data corruption", "hibernation", "reliability"]', 'cust_001', 'Acme Corp', 'enterprise', 250000, 'resolved', datetime('now', '-40 days')),
('fb_023', 'The Cloudflare dashboard redesign is clean but navigation changed too much. Took time to find familiar features.', 'forum', -0.1, 'neutral', 3, 'Dashboard', '["UX", "navigation", "redesign"]', 'cust_004', 'CloudNine Apps', 'pro', 8500, 'closed', datetime('now', '-42 days')),
('fb_024', 'Suggestion: Add ability to clone Workers between accounts. Currently have to manually redeploy for each client.', 'github', 0.3, 'neutral', 5, 'Workers', '["feature request", "multi-tenant", "DX"]', 'cust_007', 'Enterprise Solutions Ltd', 'enterprise', 450000, 'acknowledged', datetime('now', '-45 days')),
('fb_025', 'Workers Cron Triggers are unreliable. Jobs missed execution 3 times this week with no explanation in logs.', 'support', -0.65, 'frustrated', 8, 'Workers', '["cron", "reliability", "scheduled tasks"]', 'cust_005', 'DevOps Masters', 'enterprise', 320000, 'resolved', datetime('now', '-48 days')),

-- Past 3 Months  
('fb_026', 'D1 time travel feature saved us during an accidental data deletion. This should be highlighted more in marketing!', 'twitter', 0.9, 'positive', 2, 'D1', '["time travel", "backup", "testimonial"]', 'cust_003', 'DataFlow Systems', 'enterprise', 180000, 'closed', datetime('now', '-55 days')),
('fb_027', 'WebSocket connections dropping randomly in Workers. Happening more frequently under high load.', 'github', -0.5, 'concerned', 7, 'Workers', '["WebSocket", "connection drops", "scaling"]', 'cust_001', 'Acme Corp', 'enterprise', 250000, 'resolved', datetime('now', '-60 days')),
('fb_028', 'Please add OpenTelemetry support for Workers. Need better observability for our microservices.', 'forum', 0.2, 'neutral', 6, 'Workers', '["feature request", "observability", "OpenTelemetry"]', 'cust_007', 'Enterprise Solutions Ltd', 'enterprise', 450000, 'acknowledged', datetime('now', '-65 days')),
('fb_029', 'Pages build cache is amazing. Our 5-minute builds now complete in under 1 minute. Huge DX improvement!', 'discord', 0.85, 'positive', 2, 'Pages', '["build cache", "performance", "DX"]', 'cust_002', 'TechStart Inc', 'pro', 12000, 'closed', datetime('now', '-70 days')),
('fb_030', 'Getting started with Workers was surprisingly easy. Deployed my first API in 20 minutes following the tutorial.', 'twitter', 0.8, 'positive', 1, 'Workers', '["onboarding", "documentation", "DX"]', 'cust_006', 'StartupXYZ', 'free', 0, 'closed', datetime('now', '-75 days')),

-- Additional variety
('fb_031', 'The new tail logs feature in wrangler is super helpful for debugging. Real-time logs are a must-have.', 'discord', 0.7, 'positive', 3, 'Wrangler', '["debugging", "logs", "DX"]', 'cust_008', 'InnovateTech', 'pro', 15000, 'closed', datetime('now', '-78 days')),
('fb_032', 'Vectorize query costs feel high for our volume. Any plans for committed use discounts?', 'support', -0.1, 'neutral', 5, 'Vectorize', '["pricing", "discounts", "enterprise"]', 'cust_007', 'Enterprise Solutions Ltd', 'enterprise', 450000, 'acknowledged', datetime('now', '-80 days')),
('fb_033', 'R2 lifecycle rules are working perfectly for our log archival. Set it and forget it approach is great.', 'forum', 0.65, 'positive', 2, 'R2', '["lifecycle rules", "archival", "automation"]', 'cust_009', 'GlobalRetail', 'enterprise', 280000, 'closed', datetime('now', '-82 days')),
('fb_034', 'Would be great if Pages could deploy from GitLab. Currently only GitHub and manual uploads are supported.', 'github', 0.1, 'neutral', 4, 'Pages', '["feature request", "GitLab", "integrations"]', 'cust_004', 'CloudNine Apps', 'pro', 8500, 'acknowledged', datetime('now', '-85 days')),
('fb_035', 'Workers AI embeddings quality is excellent. Our semantic search accuracy improved 20% after switching from OpenAI.', 'twitter', 0.9, 'positive', 2, 'Workers AI', '["embeddings", "quality", "testimonial"]', 'cust_003', 'DataFlow Systems', 'enterprise', 180000, 'closed', datetime('now', '-88 days'));

-- ============================================
-- Themes (Aggregated)
-- ============================================
INSERT INTO themes (id, theme, mentions, change_percent, sentiment, products, is_new, summary, suggested_action) VALUES
('theme_001', 'Performance Issues', 12, 25.5, 'concerned', '["Workers", "Pages", "D1"]', 0, 'Users reporting slower build times, cold starts, and query performance degradation', 'Investigate recent deployments for performance regressions'),
('theme_002', 'Documentation Gaps', 8, 15.0, 'neutral', '["Workers AI", "Queues", "Vectorize"]', 0, 'New features lacking comprehensive documentation and working examples', 'Prioritize docs updates for recently launched features'),
('theme_003', 'Reliability Concerns', 6, -10.0, 'frustrated', '["Workers", "D1", "Durable Objects"]', 0, 'Critical production issues with timeouts, data corruption, and connection drops', 'Review SLA compliance and incident response procedures'),
('theme_004', 'Feature Requests', 15, 5.0, 'positive', '["Workers", "Pages", "Hyperdrive"]', 0, 'Active community requesting Python support, MySQL Hyperdrive, GitLab integration', 'Update public roadmap with feature priorities'),
('theme_005', 'Cost Savings', 7, 40.0, 'positive', '["R2", "Workers"]', 1, 'Customers sharing significant cost reductions after migrating to Cloudflare', 'Create case studies from customer testimonials'),
('theme_006', 'Pricing Clarity', 5, 20.0, 'concerned', '["Workers AI", "Vectorize"]', 1, 'Confusion around pricing tiers and quota limits for AI products', 'Simplify pricing page and add usage calculator');

-- ============================================
-- Alerts
-- ============================================
INSERT INTO alerts (id, type, message, product, acknowledged, feedback_ids, created_at) VALUES
('alert_001', 'critical', 'Multiple enterprise customers reporting Workers deployment failures. 3 P0 tickets in last 6 hours.', 'Workers', 0, '["fb_001"]', datetime('now', '-2 hours')),
('alert_002', 'critical', 'D1 error rate spike detected. 5x increase in 500 errors reported by customers.', 'D1', 0, '["fb_002"]', datetime('now', '-5 hours')),
('alert_003', 'warning', 'Pages build time regression detected. Average build time increased 300% after v2.1 release.', 'Pages', 0, '["fb_005", "fb_020"]', datetime('now', '-1 day')),
('alert_004', 'warning', 'Workers AI rate limiting issues reported despite available quota. Investigating billing sync.', 'Workers AI', 1, '["fb_008"]', datetime('now', '-3 days')),
('alert_005', 'info', 'Trending positive: R2 cost savings mentions up 40% this week. Good PR opportunity.', 'R2', 1, '["fb_021", "fb_033"]', datetime('now', '-5 days'));
