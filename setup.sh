#!/bin/bash

# Signal Platform Setup Script
# This script sets up the entire Signal platform including:
# - Frontend (React + Vite)
# - Backend (FastAPI)
# - Cloudflare Workers + D1 + Vectorize

set -e

echo "🚀 Setting up Signal Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed. Please install Node.js 18+${NC}"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Python 3 is not installed. Please install Python 3.11+${NC}"
        exit 1
    fi
    
    # Check Wrangler
    if ! command -v wrangler &> /dev/null; then
        echo -e "${YELLOW}Wrangler not found. Installing...${NC}"
        npm install -g wrangler
    fi
    
    echo -e "${GREEN}✓ All prerequisites met${NC}"
}

# Setup Frontend
setup_frontend() {
    echo -e "${YELLOW}Setting up frontend...${NC}"
    cd frontend
    
    npm install
    
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
    cd ..
}

# Setup Backend
setup_backend() {
    echo -e "${YELLOW}Setting up backend...${NC}"
    cd backend
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Copy env file
    if [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${YELLOW}Created .env file. Please update with your credentials.${NC}"
    fi
    
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
    cd ..
}

# Setup Cloudflare
setup_cloudflare() {
    echo -e "${YELLOW}Setting up Cloudflare resources...${NC}"
    cd cloudflare
    
    npm install
    
    # Check if logged in
    if ! wrangler whoami &> /dev/null; then
        echo -e "${YELLOW}Please login to Cloudflare:${NC}"
        wrangler login
    fi
    
    echo -e "${YELLOW}Creating Cloudflare resources...${NC}"
    
    # Create D1 Database
    echo "Creating D1 database..."
    DB_OUTPUT=$(wrangler d1 create signal-feedback-db 2>&1 || true)
    echo "$DB_OUTPUT"
    
    # Extract database ID if created
    DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || echo "")
    if [ -n "$DB_ID" ]; then
        echo -e "${GREEN}✓ D1 Database created with ID: $DB_ID${NC}"
        # Update wrangler.toml with database ID
        sed -i "s/database_id = \"your-database-id\"/database_id = \"$DB_ID\"/" wrangler.toml
    fi
    
    # Create Vectorize index
    echo "Creating Vectorize index..."
    wrangler vectorize create signal-embeddings --dimensions=768 --metric=cosine 2>&1 || true
    
    # Create Queue
    echo "Creating Queue..."
    wrangler queues create signal-feedback-queue 2>&1 || true
    
    # Run migrations
    echo "Running D1 migrations..."
    wrangler d1 execute signal-feedback-db --file=./migrations/001_initial.sql --local 2>&1 || true
    
    echo -e "${GREEN}✓ Cloudflare resources configured${NC}"
    cd ..
}

# Print instructions
print_instructions() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Signal Platform Setup Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo ""
    echo "1. Update configuration files:"
    echo "   - backend/.env - Add your Cloudflare credentials"
    echo "   - cloudflare/wrangler.toml - Verify database IDs"
    echo ""
    echo "2. Start development servers:"
    echo ""
    echo "   # Terminal 1 - Frontend"
    echo "   cd frontend && npm run dev"
    echo ""
    echo "   # Terminal 2 - Backend"
    echo "   cd backend && source venv/bin/activate && uvicorn main:app --reload"
    echo ""
    echo "   # Terminal 3 - Workers (local)"
    echo "   cd cloudflare && npm run dev"
    echo ""
    echo "3. Deploy to production:"
    echo ""
    echo "   # Deploy Workers"
    echo "   cd cloudflare && npm run deploy"
    echo ""
    echo "   # Deploy Frontend to Pages"
    echo "   cd frontend && npm run build"
    echo "   wrangler pages deploy dist --project-name signal-dashboard"
    echo ""
    echo -e "${GREEN}Documentation: See README.md for full details${NC}"
    echo ""
}

# Main
main() {
    check_prerequisites
    setup_frontend
    setup_backend
    setup_cloudflare
    print_instructions
}

main "$@"
