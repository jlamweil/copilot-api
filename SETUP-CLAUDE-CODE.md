# Claude Code CLI with GitHub Copilot Backend Setup

This guide helps you set up Claude Code CLI to use GitHub Copilot's models through copilot-api instead of direct Anthropic API calls.

## Prerequisites

1. **Docker** installed
2. **Claude Code CLI** installed (`~/.local/bin/claude`)
3. **GitHub account** with Copilot access

## Quick Setup (New PC)

### 1. Clone and Build
```bash
git clone <your-repo-url>
cd copilot-api
bun install
bun run build
docker build -t copilot-api .
```

### 2. GitHub Authentication
```bash
# First time setup - authenticate with GitHub
docker run --rm -it -v "$PWD/copilot-data:/root/.local/share/copilot-api" copilot-api --auth
```

### 3. Start Copilot-API Server (Non-Interactive)
```bash
# Start server with pre-selected models (no prompts!)
docker run --rm -d -p 4141:4141 \
  -v "$PWD/copilot-data:/root/.local/share/copilot-api" \
  -e COPILOT_DEFAULT_MODEL="claude-opus-4.6" \
  -e COPILOT_SMALL_MODEL="claude-opus-4.6-fast" \
  copilot-api start --claude-code
```

### 4. Use Claude CLI
```bash
# Option A: Use the convenience script
chmod +x claude-with-copilot.sh
./claude-with-copilot.sh

# Option B: Manual environment setup
export ANTHROPIC_BASE_URL=http://localhost:4141
export ANTHROPIC_AUTH_TOKEN=dummy
export ANTHROPIC_MODEL=claude-opus-4.6
export ANTHROPIC_DEFAULT_SONNET_MODEL=claude-opus-4.6
export ANTHROPIC_SMALL_FAST_MODEL=claude-opus-4.6-fast
export ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-opus-4.6-fast
export DISABLE_NON_ESSENTIAL_MODEL_CALLS=1
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
claude
```

## Available Models

The setup supports these models (check your Copilot access):
- `claude-opus-4.6` (main model)
- `claude-opus-4.6-fast` (fast model) 
- `claude-sonnet-4.6`
- Various GPT models (gpt-5.x, gpt-4o, etc.)
- And many more...

## Environment Variables

**For Copilot-API:**
- `COPILOT_DEFAULT_MODEL` - Default model for Claude Code
- `COPILOT_SMALL_MODEL` - Small/fast model for Claude Code  

**For Claude CLI:**
- `ANTHROPIC_BASE_URL=http://localhost:4141` - Points to copilot-api
- `ANTHROPIC_AUTH_TOKEN=dummy` - Dummy token (copilot-api handles auth)
- `ANTHROPIC_MODEL` - Model to use
- Other ANTHROPIC_* vars for model preferences

## Command Line Flags

Alternative to environment variables:
```bash
docker run --rm -p 4141:4141 -v "$PWD/copilot-data:/root/.local/share/copilot-api" \
  copilot-api start --claude-code \
  --default-model claude-opus-4.6 \
  --small-model claude-opus-4.6-fast
```

## Troubleshooting

**Port conflicts:** Change `-p 4141:4141` to `-p 4142:4141` and update `ANTHROPIC_BASE_URL`

**Model not found:** Check available models in the server startup logs

**Authentication:** Re-run the auth step if you get token errors

**Usage monitoring:** Visit `http://localhost:4141/usage-viewer?endpoint=http://localhost:4141/usage`

## What This Gives You

- ✅ Claude Code CLI using **GitHub Copilot's model allocation**
- ✅ **No Anthropic API key needed**
- ✅ **Non-interactive Docker setup** for automation
- ✅ All the latest models (Claude 4.6, GPT-5.x, etc.)
- ✅ Usage tracking and monitoring

## Files Modified

- `src/start.ts` - Added non-interactive model selection
- `claude-with-copilot.sh` - Convenience script for Claude CLI setup