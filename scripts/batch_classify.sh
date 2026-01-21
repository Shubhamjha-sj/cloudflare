#!/bin/bash
# Batch AI Classification Script
# Processes all 10,000 feedback records through Workers AI
#
# Usage: ./batch_classify.sh [batch_size] [start_page]
# Example: ./batch_classify.sh 20 1

API_URL="https://signal-api.shubhjha.workers.dev/api/ai/batch-classify"
BATCH_SIZE=${1:-20}
START_PAGE=${2:-1}
DELAY_SECONDS=2  # Delay between batches to avoid rate limits

echo "========================================"
echo "Signal Platform - Batch AI Classification"
echo "========================================"
echo "Batch size: $BATCH_SIZE"
echo "Starting from page: $START_PAGE"
echo ""

page=$START_PAGE
total_processed=0
total_failed=0

while true; do
    echo -n "Processing page $page... "
    
    # Call the batch classify endpoint
    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"batch_size\": $BATCH_SIZE, \"page\": $page}")
    
    # Parse response
    processed=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('processed', 0))" 2>/dev/null)
    failed=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('failed', 0))" 2>/dev/null)
    next_page=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('next_page', 'null'))" 2>/dev/null)
    total_pages=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_pages', 0))" 2>/dev/null)
    
    # Check for errors
    if [ -z "$processed" ] || [ "$processed" = "None" ]; then
        echo "ERROR - API response: $response"
        echo "Retrying in 10 seconds..."
        sleep 10
        continue
    fi
    
    total_processed=$((total_processed + processed))
    total_failed=$((total_failed + failed))
    
    echo "Done! Processed: $processed, Failed: $failed (Total: $total_processed / Page $page of $total_pages)"
    
    # Check if we're done
    if [ "$next_page" = "null" ] || [ "$next_page" = "None" ] || [ -z "$next_page" ]; then
        echo ""
        echo "========================================"
        echo "COMPLETE!"
        echo "Total processed: $total_processed"
        echo "Total failed: $total_failed"
        echo "========================================"
        break
    fi
    
    page=$next_page
    
    # Rate limit protection
    sleep $DELAY_SECONDS
done
