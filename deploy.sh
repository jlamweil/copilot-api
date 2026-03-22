#!/bin/bash
set -e

# Claude Code CLI with GitHub Copilot Backend - Quick Deploy Script
echo "🚀 Setting up Claude Code CLI with GitHub Copilot backend..."

# Configuration
## Set your preferred discounted model IDs here
PORT="4141"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_status "Docker found"

if ! command -v bun &> /dev/null; then
    print_error "Bun is not installed. Please install Bun first."
    exit 1
fi
print_status "Bun found"

if command -v node &> /dev/null; then
    NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        print_warning "Node.js $(node -v) detected; package.json requires Node >=20."
        print_warning "Build uses Bun, but older Node may break other Node-based tooling."
    else
        print_status "Node $(node -v) is compatible"
    fi
else
    print_warning "Node.js not found; this is okay for Bun-based build, but optional tools may expect Node >=20."
fi

if [ ! -f ~/.local/bin/claude ]; then
    print_warning "Claude CLI not found at ~/.local/bin/claude"
    echo "Please install Claude Code CLI first"
fi

# Build the project
echo "🔨 Building copilot-api..."
bun install
bun run build
print_status "Project built successfully"

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t copilot-api . > /dev/null
print_status "Docker image built"

# Check if already authenticated
if [ ! -f "copilot-data/github_token" ]; then
    echo "🔐 GitHub authentication required..."
    echo "Please complete the authentication process:"
    docker run --rm -it -v "$PWD/copilot-data:/root/.local/share/copilot-api" copilot-api --auth
    print_status "GitHub authentication completed"
else
    print_status "GitHub authentication found"
fi

# Stop any existing containers on the port
if docker ps --format "table {{.Ports}}" | grep -q ":$PORT->"; then
    print_warning "Stopping existing containers on port $PORT..."
    docker stop $(docker ps -q --filter "publish=$PORT") 2>/dev/null || true
fi

# Start the server
echo "🌟 Starting copilot-api server..."
CONTAINER_ID=$(docker run -d -p $PORT:4141 \
    -v "$PWD/copilot-data:/root/.local/share/copilot-api" \
    -e COPILOT_DEFAULT_MODEL="$DEFAULT_MODEL" \
    -e COPILOT_SMALL_MODEL="$SMALL_MODEL" \
    copilot-api start --claude-code)

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Check if server is running
if curl -s http://localhost:$PORT/ | grep -q "Server running"; then
    print_status "Server is running on port $PORT"
else
    print_error "Server failed to start. Check logs with: docker logs $CONTAINER_ID"
    exit 1
fi

# Make Claude script executable
chmod +x claude-with-copilot.sh

# Final instructions
echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Use Claude CLI with copilot backend:"
echo "   ./claude-with-copilot.sh"
echo ""
echo "2. Or set environment manually and use 'claude':"
echo "   source <(docker logs $CONTAINER_ID 2>&1 | grep 'export' | tail -1 | sed 's/&&.*//')"
echo ""
echo "3. Monitor usage at:"
echo "   http://localhost:$PORT/usage-viewer?endpoint=http://localhost:$PORT/usage"
echo ""
echo "📊 Container ID: $CONTAINER_ID"
echo "🛑 To stop server: docker stop $CONTAINER_ID"
echo ""
print_status "Claude Code CLI is now using GitHub Copilot models! 🚀"