#!/usr/bin/env python3
"""
generate_feedback_records.py
=============================

This script generates a large number of dummy feedback records and inserts
them into a SQLite database. It is designed to work with the schema
defined in the provided `signal-db-backup.sql` file, which defines a
`feedback` table with the following structure:

```
CREATE TABLE feedback (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('github', 'discord', 'twitter', 'support', 'forum', 'email')),
    sentiment REAL DEFAULT 0.0,
    sentiment_label TEXT DEFAULT 'neutral',
    urgency INTEGER DEFAULT 5 CHECK (urgency >= 1 AND urgency <= 10),
    product TEXT,
    themes TEXT DEFAULT '[]', -- JSON array
    customer_id TEXT,
    customer_name TEXT,
    customer_tier TEXT CHECK (customer_tier IN ('enterprise', 'pro', 'free', 'unknown')),
    customer_arr INTEGER DEFAULT 0,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'acknowledged', 'in_progress', 'resolved', 'closed')),
    assigned_to TEXT,
    metadata TEXT DEFAULT '{}', -- JSON object
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

The goal of the script is to populate this table with a large number of
synthetic rows while distributing them evenly across sources, customers
and dates within a given time window. By default it generates one
million records spanning the last 90 days, cycling through six sources
(github, discord, twitter, support, forum, email) and ten customers
(cust_001 through cust_010).

Usage:

    python generate_feedback_records.py --db path/to/database.db --num_records 1000000

The script will create the `feedback` table if it does not already
exist by executing the SQL contained in `signal-db-backup.sql` located
in the same directory as this script. After creation it will insert
records in batches of 5,000 for efficiency.

You can adjust the number of records and the time window by passing
`--num_records` and `--days` arguments. Increasing the number of
records will increase the runtime proportionally.
"""

import argparse
import datetime
import json
import os
import random
import sqlite3
import sys
import uuid
from typing import List, Tuple


def random_time_in_day(day_start: datetime.datetime) -> datetime.datetime:
    """Return a random datetime within the same day as day_start."""
    # There are 24*60*60 seconds in a day.
    seconds_in_day = 24 * 60 * 60
    return day_start + datetime.timedelta(seconds=random.randint(0, seconds_in_day - 1))


def ensure_feedback_table(conn: sqlite3.Connection, schema_file: str) -> None:
    """
    Ensure the feedback table exists in the provided SQLite connection.
    If it does not exist, execute the SQL contained in `schema_file` to create it.

    Args:
        conn: An open sqlite3.Connection object.
        schema_file: Path to a SQL file containing the schema definition.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
    if cursor.fetchone():
        return  # Table already exists
    # Read and execute schema SQL
    if not os.path.exists(schema_file):
        raise FileNotFoundError(f"Schema file not found: {schema_file}")
    with open(schema_file, 'r', encoding='utf-8') as f:
        sql_script = f.read()
    conn.executescript(sql_script)
    conn.commit()


def generate_records(
    num_records: int,
    days: int,
    sources: List[str],
    customer_ids: List[str],
    customer_names: List[str],
    start_date: datetime.datetime,
    products: List[str],
    customer_tiers: List[str],
    statuses: List[str]
) -> List[Tuple]:
    """
    Generate a list of tuples representing rows for insertion into the
    feedback table. Distribution across (day, source, customer) is as
    even as possible given the specified number of records.

    Args:
        num_records: Total number of rows to generate.
        days: Number of days over which to spread the generated dates.
        sources: List of source labels.
        customer_ids: List of customer IDs.
        customer_names: List of customer names corresponding to IDs.
        start_date: Datetime representing the earliest date for records.
        products: List of product names.
        customer_tiers: List of customer tier labels.
        statuses: List of possible status values.

    Returns:
        A list of tuples, each containing values matching the columns
        expected by the feedback table insert statement.
    """
    combos = []
    # Create a list of all combinations of day index, source and customer
    for day_index in range(days):
        for src in sources:
            for cid in range(len(customer_ids)):
                combos.append((day_index, src, cid))
    total_combos = len(combos)
    # Determine how many records per combination and how many left over
    base_n = num_records // total_combos
    remainder = num_records % total_combos
    # Randomly shuffle combos so remainder distribution is random
    random.shuffle(combos)

    # Precompute a pool of theme keywords for random selection
    theme_pool = ['performance', 'bug', 'feature', 'design', 'deployment', 'database', 'api']
    records: List[Tuple] = []

    for combo_index, (day_index, src, cust_idx) in enumerate(combos):
        # Determine number of records for this combination
        n = base_n + (1 if combo_index < remainder else 0)
        # Compute the base date for this combination
        day_start = start_date + datetime.timedelta(days=day_index)
        for _ in range(n):
            # Unique feedback ID
            fid = f"fb_{uuid.uuid4().hex[:12]}"
            # Simple placeholder content; for real use you might select from a list
            content = f"Dummy feedback message for {customer_names[cust_idx]} via {src}"
            # Sentiment score and label
            sentiment_score = round(random.uniform(-1, 1), 3)
            if sentiment_score < -0.3:
                sentiment_label = 'negative'
            elif sentiment_score > 0.3:
                sentiment_label = 'positive'
            else:
                sentiment_label = 'neutral'
            urgency = random.randint(1, 10)
            product = random.choice(products)
            themes_json = json.dumps(random.sample(theme_pool, k=2))
            cust_id = customer_ids[cust_idx]
            cust_name = customer_names[cust_idx]
            tier = random.choice(customer_tiers)
            arr = random.randint(0, 500000)
            status = random.choice(statuses)
            assigned_to = None  # None translates to NULL in sqlite
            metadata = '{}'
            dt = random_time_in_day(day_start)
            created_at = dt.strftime('%Y-%m-%d %H:%M:%S')
            updated_at = created_at
            records.append((
                fid,
                content,
                src,
                sentiment_score,
                sentiment_label,
                urgency,
                product,
                themes_json,
                cust_id,
                cust_name,
                tier,
                arr,
                status,
                assigned_to,
                metadata,
                created_at,
                updated_at,
            ))
    return records


def insert_records(conn: sqlite3.Connection, records: List[Tuple], batch_size: int = 5000) -> None:
    """
    Insert a list of records into the feedback table in batches.

    Args:
        conn: An open sqlite3.Connection object.
        records: A list of tuples ready for insertion.
        batch_size: Number of rows per batch.
    """
    insert_sql = (
        """
        INSERT INTO feedback (
            id, content, source, sentiment, sentiment_label, urgency, product,
            themes, customer_id, customer_name, customer_tier, customer_arr,
            status, assigned_to, metadata, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        """
    )
    cursor = conn.cursor()
    for start in range(0, len(records), batch_size):
        batch = records[start:start + batch_size]
        cursor.executemany(insert_sql, batch)
        conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description='Generate dummy feedback records for a SQLite database.')
    parser.add_argument('--db', required=True, help='Path to the SQLite database file.')
    parser.add_argument('--num_records', type=int, default=1_000_000,
                        help='Number of feedback records to generate (default: 1_000_000).')
    parser.add_argument('--days', type=int, default=90,
                        help='Number of days across which to distribute created_at timestamps (default: 90).')
    parser.add_argument('--schema', type=str, default='signal-db-backup.sql',
                        help='Path to the SQL schema file used to create the feedback table if missing.')
    args = parser.parse_args()

    # Seed the random number generator for reproducibility
    random.seed(42)

    db_path = args.db
    # Ensure directory exists
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)

    # Ensure the feedback table exists
    schema_path = args.schema
    if not os.path.isabs(schema_path):
        # Resolve schema file relative to the script directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        schema_path = os.path.join(script_dir, schema_path)
    ensure_feedback_table(conn, schema_path)

    # Prepare lists for dummy data
    sources = ['github', 'discord', 'twitter', 'support', 'forum', 'email']
    customer_ids = [f'cust_{i:03d}' for i in range(1, 11)]
    customer_names = [f'Customer {i:03d}' for i in range(1, 11)]
    products = ['Workers', 'D1', 'Pages', 'Queues', 'R2', 'AI']
    customer_tiers = ['enterprise', 'pro', 'free', 'unknown']
    statuses = ['new', 'in_review', 'acknowledged', 'in_progress', 'resolved', 'closed']
    end_date = datetime.datetime.utcnow()
    # The earliest date is `days` days before now
    start_date = end_date - datetime.timedelta(days=args.days)

    # Generate all records
    print(f"Generating {args.num_records} records...")
    records = generate_records(
        num_records=args.num_records,
        days=args.days,
        sources=sources,
        customer_ids=customer_ids,
        customer_names=customer_names,
        start_date=start_date,
        products=products,
        customer_tiers=customer_tiers,
        statuses=statuses,
    )
    print(f"Generated {len(records)} records. Inserting into database...")
    insert_records(conn, records)
    conn.close()
    print(f"Inserted {len(records)} records into {db_path}")
    return 0


if __name__ == '__main__':
    sys.exit(main())