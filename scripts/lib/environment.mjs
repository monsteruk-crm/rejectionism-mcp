import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

/**
 * Standardized quiet environment loading.
 *
 * Precedence:
 * 1. Explicit CLI flag: `--env-file=<path>` or `--env-file <path>`
 * 2. `process.env.CAMPAIGNOS_TEST_ENV_FILE`
 * 3. `process.env.DOTENV_CONFIG_PATH`
 * 4. Default: `.env.local` then `.env`
 *
 * Inherited environment variables always win (override: false).
 * Missing explicit files throw an Error.
 * Missing default files are silently ignored.
 */
export function loadEnvironment(options = {}) {
  const argv = options.argv || process.argv.slice(2);
  const rootDir = options.rootDir || process.cwd();

  // Check CLI arguments for --env-file
  let explicitFile = undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--env-file=")) {
      explicitFile = arg.slice("--env-file=".length);
      break;
    }
    if (arg === "--env-file" && i + 1 < argv.length) {
      explicitFile = argv[i + 1];
      break;
    }
  }

  // Check environment variables if no CLI flag
  if (!explicitFile) {
    if (process.env.CAMPAIGNOS_TEST_ENV_FILE) {
      explicitFile = process.env.CAMPAIGNOS_TEST_ENV_FILE;
    } else if (process.env.DOTENV_CONFIG_PATH) {
      explicitFile = process.env.DOTENV_CONFIG_PATH;
    }
  }

  if (explicitFile) {
    const resolvedPath = resolve(rootDir, explicitFile);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Explicitly specified environment file not found: ${resolvedPath}`);
    }
    return dotenv.config({ path: resolvedPath, override: false, quiet: true });
  }

  // Default files: .env.local then .env
  const localPath = resolve(rootDir, ".env.local");
  if (existsSync(localPath)) {
    dotenv.config({ path: localPath, override: false, quiet: true });
  }

  const envPath = resolve(rootDir, ".env");
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false, quiet: true });
  }

  return { parsed: process.env };
}

// Auto-load on import
loadEnvironment();
