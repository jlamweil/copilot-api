#!/bin/bash
# Claude Code CLI with GitHub Copilot backend

# Set environment variables to connect to copilot-api
export ANTHROPIC_BASE_URL=http://localhost:4141
export ANTHROPIC_AUTH_TOKEN=dummy
export ANTHROPIC_MODEL=auto
export ANTHROPIC_DEFAULT_SONNET_MODEL=auto
export ANTHROPIC_SMALL_FAST_MODEL=auto
export ANTHROPIC_DEFAULT_HAIKU_MODEL=auto
export DISABLE_NON_ESSENTIAL_MODEL_CALLS=1
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

# Start Claude CLI
if [ $# -gt 0 ]; then
	claude "$@"
else
	claude
fi