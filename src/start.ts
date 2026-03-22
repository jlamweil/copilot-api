#!/usr/bin/env node

import { defineCommand } from "citty"
import clipboard from "clipboardy"
import consola from "consola"
import { serve, type ServerHandler } from "srvx"
import invariant from "tiny-invariant"

import { mergeConfigWithDefaults } from "./lib/config"
import { ensurePaths } from "./lib/paths"
import { initProxyFromEnv } from "./lib/proxy"
import { generateEnvScript } from "./lib/shell"
import { state } from "./lib/state"
import { setupCopilotToken, setupGitHubToken } from "./lib/token"
import {
  cacheMacMachineId,
  cacheModels,
  cacheVSCodeVersion,
  cacheVsCodeSessionId,
} from "./lib/utils"

interface RunServerOptions {
  port: number
  verbose: boolean
  accountType: string
  manual: boolean
  rateLimit?: number
  rateLimitWait: boolean
  githubToken?: string
  claudeCode: boolean
  showToken: boolean
  proxyEnv: boolean
  defaultModel?: string
  smallModel?: string
}

async function selectModel(options: {
  defaultModel: string | undefined
  models: Array<{ id: string }>
  promptText: string
}): Promise<string> {
  if (!options.defaultModel) {
    return consola.prompt(options.promptText, {
      type: "select",
      options: options.models.map((model) => model.id),
    })
  }

  // Validate that the selected model exists
  const modelExists = options.models.some(
    (model) => model.id === options.defaultModel,
  )
  if (!modelExists) {
    consola.error(
      `Model "${options.defaultModel}" not found in available models`,
    )
    consola.info(
      `Available models: ${options.models.map((m) => m.id).join(", ")}`,
    )
    process.exit(1)
  }
  consola.info(`Using model: ${options.defaultModel}`)
  return options.defaultModel
}

function setupClaudeCode(
  selectedModel: string,
  selectedSmallModel: string,
  serverUrl: string,
): void {
  const command = generateEnvScript(
    {
      ANTHROPIC_BASE_URL: serverUrl,
      ANTHROPIC_AUTH_TOKEN: "dummy",
      ANTHROPIC_MODEL: selectedModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: selectedModel,
      ANTHROPIC_SMALL_FAST_MODEL: selectedSmallModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: selectedSmallModel,
      DISABLE_NON_ESSENTIAL_MODEL_CALLS: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
    "claude",
  )

  try {
    clipboard.writeSync(command)
    consola.success("Copied Claude Code command to clipboard!")
  } catch {
    consola.warn(
      "Failed to copy to clipboard. Here is the Claude Code command:",
    )
    consola.log(command)
  }
}

export async function runServer(options: RunServerOptions): Promise<void> {
  // Ensure config is merged with defaults at startup
  mergeConfigWithDefaults()

  if (options.proxyEnv) {
    initProxyFromEnv()
  }

  state.verbose = options.verbose
  if (options.verbose) {
    consola.level = 5
    consola.info("Verbose logging enabled")
  }

  state.accountType = options.accountType
  if (options.accountType !== "individual") {
    consola.info(`Using ${options.accountType} plan GitHub account`)
  }

  state.manualApprove = options.manual
  state.rateLimitSeconds = options.rateLimit
  state.rateLimitWait = options.rateLimitWait
  state.showToken = options.showToken

  await ensurePaths()
  await cacheVSCodeVersion()
  cacheMacMachineId()
  cacheVsCodeSessionId()

  if (options.githubToken) {
    state.githubToken = options.githubToken
    consola.info("Using provided GitHub token")
  } else {
    await setupGitHubToken()
  }

  await setupCopilotToken()
  await cacheModels()

  consola.info(
    `Available models: \n${state.models?.data.map((model) => `- ${model.id}`).join("\n")}`,
  )

  const serverUrl = `http://localhost:${options.port}`

  if (options.claudeCode) {
    consola.log(
      "\n💡 Tip: The --claude-code flag simply generates a clipboard command for launching Claude Code. \n"
        + "All models remain fully accessible without this flag, just configure the model ID directly in your settings.json file.",
    )

    invariant(state.models, "Models should be loaded by now")

    const defaultModel =
      options.defaultModel || process.env.COPILOT_DEFAULT_MODEL
    const defaultSmallModel =
      options.smallModel || process.env.COPILOT_SMALL_MODEL

    const selectedModel = await selectModel({
      defaultModel,
      models: state.models.data,
      promptText: "Select a model to use with Claude Code",
    })

    const selectedSmallModel = await selectModel({
      defaultModel: defaultSmallModel,
      models: state.models.data,
      promptText: "Select a small model to use with Claude Code",
    })

    setupClaudeCode(selectedModel, selectedSmallModel, serverUrl)
  }

  consola.box(
    `🌐 Usage Viewer: ${serverUrl}/usage-viewer?endpoint=${serverUrl}/usage`,
  )

  const { server } = await import("./server")

  serve({
    fetch: server.fetch as ServerHandler,
    port: options.port,
    bun: {
      idleTimeout: 0,
    },
  })
}

export const start = defineCommand({
  meta: {
    name: "start",
    description: "Start the Copilot API server",
  },
  args: {
    port: {
      alias: "p",
      type: "string",
      default: "4141",
      description: "Port to listen on",
    },
    verbose: {
      alias: "v",
      type: "boolean",
      default: false,
      description: "Enable verbose logging",
    },
    "account-type": {
      alias: "a",
      type: "string",
      default: "individual",
      description: "Account type to use (individual, business, enterprise)",
    },
    manual: {
      type: "boolean",
      default: false,
      description: "Enable manual request approval",
    },
    "rate-limit": {
      alias: "r",
      type: "string",
      description: "Rate limit in seconds between requests",
    },
    wait: {
      alias: "w",
      type: "boolean",
      default: false,
      description:
        "Wait instead of error when rate limit is hit. Has no effect if rate limit is not set",
    },
    "github-token": {
      alias: "g",
      type: "string",
      description:
        "Provide GitHub token directly (must be generated using the `auth` subcommand)",
    },
    "claude-code": {
      alias: "c",
      type: "boolean",
      default: false,
      description:
        "Generate a command to launch Claude Code with Copilot API config",
    },
    "show-token": {
      type: "boolean",
      default: false,
      description: "Show GitHub and Copilot tokens on fetch and refresh",
    },
    "proxy-env": {
      type: "boolean",
      default: false,
      description: "Initialize proxy from environment variables",
    },
    "default-model": {
      type: "string",
      description:
        "Default model to use with Claude Code (bypasses interactive selection)",
    },
    "small-model": {
      type: "string",
      description:
        "Small/fast model to use with Claude Code (bypasses interactive selection)",
    },
  },
  run({ args }) {
    const rateLimitRaw = args["rate-limit"]
    const rateLimit =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      rateLimitRaw === undefined ? undefined : Number.parseInt(rateLimitRaw, 10)

    return runServer({
      port: Number.parseInt(args.port, 10),
      verbose: args.verbose,
      accountType: args["account-type"],
      manual: args.manual,
      rateLimit,
      rateLimitWait: args.wait,
      githubToken: args["github-token"],
      claudeCode: args["claude-code"],
      showToken: args["show-token"],
      proxyEnv: args["proxy-env"],
      defaultModel: args["default-model"],
      smallModel: args["small-model"],
    })
  },
})
