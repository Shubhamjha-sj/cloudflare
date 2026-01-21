#!/usr/bin/env python3
"""
Generate 1000 realistic feedback entries for Signal Platform
Distributed evenly across themes, products, sources, customers, and 90 days
"""

import json
import random
import uuid
from datetime import datetime, timedelta

# Configuration
NUM_RECORDS = 1000
DAYS = 90

# Products (Cloudflare products)
PRODUCTS = ['workers', 'r2', 'pages', 'd1', 'kv', 'durable-objects', 'queues', 'images']

# Sources
SOURCES = ['github', 'discord', 'twitter', 'support', 'forum', 'email']

# Customer tiers
TIERS = ['enterprise', 'pro', 'free']

# Customers (10 realistic customers)
CUSTOMERS = [
    {'id': 'cust_001', 'name': 'TechCorp Inc', 'tier': 'enterprise', 'arr': 250000},
    {'id': 'cust_002', 'name': 'StartupXYZ', 'tier': 'pro', 'arr': 12000},
    {'id': 'cust_003', 'name': 'GlobalMedia Ltd', 'tier': 'enterprise', 'arr': 180000},
    {'id': 'cust_004', 'name': 'DevStudio', 'tier': 'pro', 'arr': 24000},
    {'id': 'cust_005', 'name': 'CloudFirst', 'tier': 'enterprise', 'arr': 320000},
    {'id': 'cust_006', 'name': 'IndieDev', 'tier': 'free', 'arr': 0},
    {'id': 'cust_007', 'name': 'DataFlow Systems', 'tier': 'enterprise', 'arr': 150000},
    {'id': 'cust_008', 'name': 'WebAgency Pro', 'tier': 'pro', 'arr': 36000},
    {'id': 'cust_009', 'name': 'OpenSource Collective', 'tier': 'free', 'arr': 0},
    {'id': 'cust_010', 'name': 'FinTech Solutions', 'tier': 'enterprise', 'arr': 420000},
]

# Themes with realistic feedback templates
FEEDBACK_TEMPLATES = {
    'cold-starts': {
        'themes': ['performance', 'reliability'],
        'sentiment_range': (-0.8, -0.3),
        'urgency_range': (6, 9),
        'templates': [
            "Workers cold starts are causing timeouts in our {product} app. Seeing {ms}ms+ delays on first request.",
            "Cold start latency is killing our user experience. First request takes {ms}ms when it should be instant.",
            "We're experiencing severe cold start issues with {product}. This is blocking our production deployment.",
            "The cold start time for our Worker has increased significantly after the last update. Now seeing {ms}ms delays.",
            "Is there any way to reduce cold start times? Our {product} app is timing out for users.",
        ]
    },
    'cors-issues': {
        'themes': ['bug', 'documentation'],
        'sentiment_range': (-0.7, -0.2),
        'urgency_range': (5, 8),
        'templates': [
            "Getting CORS errors when accessing {product} from our frontend. Headers seem correct but still failing.",
            "Presigned URLs for {product} are returning 403 errors due to CORS. Documentation doesn't help.",
            "CORS configuration isn't working as documented for {product}. Tried everything in the docs.",
            "Can't get CORS to work with {product}. Keep getting 'Access-Control-Allow-Origin' errors.",
            "Our {product} API calls fail with CORS errors in production but work in development.",
        ]
    },
    'pricing-confusion': {
        'themes': ['pricing', 'documentation'],
        'sentiment_range': (-0.5, 0.0),
        'urgency_range': (3, 6),
        'templates': [
            "The pricing model for {product} is confusing. How do I estimate costs for {num}M requests/month?",
            "Unexpected charges on our {product} bill. Can someone explain the pricing breakdown?",
            "Need clarity on {product} pricing tiers. The calculator doesn't match our actual usage.",
            "Is there a way to set spending limits for {product}? Worried about unexpected bills.",
            "The {product} free tier limits are unclear. When exactly do charges start?",
        ]
    },
    'deployment-failures': {
        'themes': ['deployment', 'bug'],
        'sentiment_range': (-0.9, -0.4),
        'urgency_range': (7, 10),
        'templates': [
            "Deployment to {product} keeps failing with cryptic error messages. Build works locally.",
            "{product} deployment stuck at 'uploading' for over an hour. No error, just hangs.",
            "Getting 'out of memory' errors during {product} build even though our bundle is small.",
            "Wrangler crashes when deploying to {product}. Error: {error_code}",
            "CI/CD pipeline failing on {product} deployment. Was working yesterday, no changes made.",
        ]
    },
    'documentation-gaps': {
        'themes': ['documentation', 'developer-experience'],
        'sentiment_range': (-0.4, 0.2),
        'urgency_range': (2, 5),
        'templates': [
            "The {product} docs are missing examples for {feature}. Had to figure it out from source code.",
            "Documentation for {product} {feature} is outdated. The API has changed since it was written.",
            "Can't find any docs on how to use {product} with {integration}. Is this supported?",
            "The {product} quickstart guide skips important steps. Took hours to debug.",
            "Wish the {product} docs had more real-world examples instead of just basic usage.",
        ]
    },
    'performance-praise': {
        'themes': ['performance', 'developer-experience'],
        'sentiment_range': (0.6, 1.0),
        'urgency_range': (1, 2),
        'templates': [
            "Just migrated to {product} and the performance is incredible! Response times dropped by {percent}%.",
            "Love how fast {product} is! Our API latency went from {old_ms}ms to {new_ms}ms.",
            "{product} has been rock solid for us. Zero downtime in {months} months.",
            "The developer experience with {product} is amazing. Deployed our first app in minutes.",
            "Impressed with {product} performance. Handles our {num}K concurrent users without breaking a sweat.",
        ]
    },
    'feature-requests': {
        'themes': ['feature-request', 'developer-experience'],
        'sentiment_range': (0.0, 0.4),
        'urgency_range': (3, 6),
        'templates': [
            "Would love to see {feature} added to {product}. This would help with {use_case}.",
            "Feature request: {product} needs better support for {integration}.",
            "Is there a roadmap for {product}? Really hoping to see {feature} soon.",
            "Suggesting {feature} for {product} - this would save us hours of workarounds.",
            "Any plans to add {feature} to {product}? Currently using a hacky solution.",
        ]
    },
    'database-issues': {
        'themes': ['database', 'performance'],
        'sentiment_range': (-0.6, -0.1),
        'urgency_range': (5, 8),
        'templates': [
            "D1 queries are slower than expected. A simple SELECT takes {ms}ms on a small table.",
            "Getting 'database is locked' errors with D1 under moderate load.",
            "D1 connection pooling doesn't seem to work. Each request opens a new connection.",
            "Our D1 database hit the size limit. Need guidance on optimization or upgrading.",
            "D1 migrations keep failing silently. No error but schema doesn't update.",
        ]
    },
    'api-rate-limits': {
        'themes': ['api', 'reliability'],
        'sentiment_range': (-0.5, -0.1),
        'urgency_range': (5, 8),
        'templates': [
            "Hitting rate limits on {product} API even though we're well under documented limits.",
            "The {product} rate limiting is too aggressive for our use case. Need higher limits.",
            "Getting 429 errors from {product} randomly. Our request rate is consistent.",
            "Rate limit documentation for {product} doesn't match actual behavior.",
            "Is there a way to get higher rate limits for {product}? Current limits are blocking us.",
        ]
    },
    'integration-success': {
        'themes': ['integration', 'developer-experience'],
        'sentiment_range': (0.5, 0.9),
        'urgency_range': (1, 3),
        'templates': [
            "Successfully integrated {product} with {integration}. The SDK made it super easy!",
            "Our {integration} + {product} setup is working great. Took less than a day to set up.",
            "{product} plays nicely with our existing {integration} infrastructure. Very happy.",
            "The {product} API is well-designed. Integrated with {integration} without any issues.",
            "Thanks to the team for the {integration} support in {product}. Works perfectly.",
        ]
    },
}

# Fill-in values for templates
FEATURES = ['cron triggers', 'websockets', 'streaming responses', 'custom domains', 'analytics', 
            'env variables', 'secrets management', 'multi-region', 'edge caching', 'real-time logs']
INTEGRATIONS = ['Next.js', 'Remix', 'Astro', 'SvelteKit', 'Nuxt', 'React', 'Vue', 'GitHub Actions', 
                'Terraform', 'Pulumi', 'Vercel', 'Netlify']
ERROR_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ERR_WORKER_LIMIT', 'SCRIPT_TOO_LARGE', 'MEMORY_LIMIT_EXCEEDED']
USE_CASES = ['caching', 'authentication', 'rate limiting', 'A/B testing', 'geo-routing', 'image optimization']

def generate_content(template_key: str, product: str) -> tuple[str, list[str], float, int]:
    """Generate feedback content from template"""
    template_data = FEEDBACK_TEMPLATES[template_key]
    template = random.choice(template_data['templates'])
    
    # Fill in template variables
    content = template.format(
        product=product,
        ms=random.randint(300, 1500),
        percent=random.randint(40, 80),
        old_ms=random.randint(200, 500),
        new_ms=random.randint(10, 50),
        months=random.randint(3, 18),
        num=random.randint(10, 500),
        feature=random.choice(FEATURES),
        integration=random.choice(INTEGRATIONS),
        error_code=random.choice(ERROR_CODES),
        use_case=random.choice(USE_CASES),
    )
    
    themes = template_data['themes']
    sentiment = round(random.uniform(*template_data['sentiment_range']), 3)
    urgency = random.randint(*template_data['urgency_range'])
    
    return content, themes, sentiment, urgency

def get_sentiment_label(sentiment: float) -> str:
    """Convert sentiment score to label"""
    if sentiment >= 0.3:
        return 'positive'
    elif sentiment >= -0.1:
        return 'neutral'
    elif sentiment >= -0.3:
        return 'concerned'
    elif sentiment >= -0.5:
        return 'annoyed'
    else:
        return 'frustrated'

def generate_records():
    """Generate all feedback records"""
    records = []
    now = datetime.now()
    start_date = now - timedelta(days=DAYS)
    
    template_keys = list(FEEDBACK_TEMPLATES.keys())
    
    for i in range(NUM_RECORDS):
        # Distribute evenly
        template_key = template_keys[i % len(template_keys)]
        product = PRODUCTS[i % len(PRODUCTS)]
        source = SOURCES[i % len(SOURCES)]
        customer = CUSTOMERS[i % len(CUSTOMERS)]
        
        # Random time within the 90 days
        random_days = random.uniform(0, DAYS)
        created_at = start_date + timedelta(days=random_days)
        
        # Generate content
        content, themes, sentiment, urgency = generate_content(template_key, product)
        
        record = {
            'id': f'fb_{uuid.uuid4().hex[:12]}',
            'content': content,
            'source': source,
            'sentiment': sentiment,
            'sentiment_label': get_sentiment_label(sentiment),
            'urgency': urgency,
            'product': product,
            'themes': themes,
            'customer_id': customer['id'],
            'customer_name': customer['name'],
            'customer_tier': customer['tier'],
            'customer_arr': customer['arr'],
            'status': random.choice(['new', 'in_review', 'acknowledged', 'in_progress', 'resolved']),
            'assigned_to': None,
            'metadata': {},
            'created_at': created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': created_at.strftime('%Y-%m-%d %H:%M:%S'),
        }
        records.append(record)
    
    return records

def generate_sql(records: list) -> str:
    """Generate SQL INSERT statements"""
    sql_lines = ['-- Clear existing feedback', 'DELETE FROM feedback;', '']
    sql_lines.append('-- Insert realistic feedback records')
    
    for record in records:
        sql = f"""INSERT INTO feedback (id, content, source, sentiment, sentiment_label, urgency, product, themes, customer_id, customer_name, customer_tier, customer_arr, status, assigned_to, metadata, created_at, updated_at)
VALUES ('{record['id']}', '{record['content'].replace("'", "''")}', '{record['source']}', {record['sentiment']}, '{record['sentiment_label']}', {record['urgency']}, '{record['product']}', '{json.dumps(record['themes'])}', '{record['customer_id']}', '{record['customer_name']}', '{record['customer_tier']}', {record['customer_arr']}, '{record['status']}', NULL, '{{}}', '{record['created_at']}', '{record['updated_at']}');"""
        sql_lines.append(sql)
    
    return '\n'.join(sql_lines)

if __name__ == '__main__':
    print(f"Generating {NUM_RECORDS} realistic feedback records...")
    records = generate_records()
    
    # Generate SQL file
    sql = generate_sql(records)
    
    output_file = '/home/shubh/projects/signal-platform/scripts/realistic_feedback.sql'
    with open(output_file, 'w') as f:
        f.write(sql)
    
    print(f"Generated SQL file: {output_file}")
    print(f"\nDistribution:")
    print(f"  - Templates: {len(FEEDBACK_TEMPLATES)} types")
    print(f"  - Products: {len(PRODUCTS)} products")
    print(f"  - Sources: {len(SOURCES)} sources")
    print(f"  - Customers: {len(CUSTOMERS)} customers")
    print(f"  - Time span: {DAYS} days")
    
    # Show sample
    print(f"\nSample records:")
    for i, r in enumerate(records[:3]):
        print(f"\n{i+1}. {r['content'][:80]}...")
        print(f"   Product: {r['product']}, Themes: {r['themes']}, Sentiment: {r['sentiment']:.2f}")
