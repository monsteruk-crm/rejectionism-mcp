import "./lib/environment.mjs";
import { runUploadCleanup } from "../lib/campaign/upload-cleanup";
import { getStorageProvider } from "../lib/storage/vercel-blob";
import { computeDatabaseFingerprint } from "./lib/test-target.mjs";

/**
 * Abandoned upload-file cleanup CLI.
 *
 * Accepted arguments:
 * - `--dry-run` (default mode)
 * - `--apply` (requires `--confirm-target <fingerprint>`)
 * - `--limit <N>` (1..1000, default 100)
 * - `--request-id <ID>` (scopes cleanup to a specific upload request)
 * - `--confirm-target <fingerprint>` (required when --apply is used)
 */

export function parseCleanupArgs(argv: string[]) {
  const args = argv.filter((a) => a !== "--");
  let dryRunSpecified = false;
  let applySpecified = false;
  let limit = 100;
  let requestId: string | undefined = undefined;
  let confirmTarget: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRunSpecified = true;
    } else if (arg === "--apply") {
      applySpecified = true;
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.slice("--limit=".length), 10);
    } else if (arg === "--limit" && i + 1 < args.length) {
      limit = parseInt(args[++i], 10);
    } else if (arg.startsWith("--request-id=")) {
      requestId = arg.slice("--request-id=".length);
    } else if (arg === "--request-id" && i + 1 < args.length) {
      requestId = args[++i];
    } else if (arg.startsWith("--confirm-target=")) {
      confirmTarget = arg.slice("--confirm-target=".length);
    } else if (arg === "--confirm-target" && i + 1 < args.length) {
      confirmTarget = args[++i];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (dryRunSpecified && applySpecified) {
    throw new Error("Conflicting flags: cannot specify both --dry-run and --apply.");
  }

  if (isNaN(limit) || limit < 1 || limit > 1000) {
    throw new Error("Invalid limit: must be a positive integer between 1 and 1000.");
  }

  const apply = applySpecified;

  return {
    apply,
    limit,
    requestId,
    confirmTarget,
  };
}

async function main(): Promise<void> {
  const options = parseCleanupArgs(process.argv.slice(2));

  if (options.apply) {
    const dbUrl = process.env.MCP_PRISMA_DATABASE_URL;
    if (!dbUrl) {
      throw new Error("MCP_PRISMA_DATABASE_URL is required in environment.");
    }

    const currentFingerprint = computeDatabaseFingerprint(dbUrl);
    if (!options.confirmTarget || options.confirmTarget !== currentFingerprint) {
      throw new Error(
        `--confirm-target ${currentFingerprint} is required when running with --apply to protect operational targets.`,
      );
    }

    process.stdout.write(
      "Cleanup is running with --apply: eligible unreferenced upload files will be discarded and deleted from the private blob store.\n",
    );
  } else {
    process.stdout.write(
      "Dry run (default): reporting candidates only. Pass --apply and --confirm-target <fingerprint> to discard and delete.\n",
    );
  }

  const summary = await runUploadCleanup({
    apply: options.apply,
    provider: getStorageProvider(),
    limit: options.limit,
    requestId: options.requestId,
  });

  for (const candidate of summary.candidates) {
    process.stdout.write(
      `candidate id=${candidate.id} requestStatus=${candidate.requestStatus} fileStatus=${candidate.fileStatus} bytes=${candidate.expectedByteSize} reason=${candidate.reason}\n`,
    );
  }

  process.stdout.write(
    `done dryRun=${String(summary.dryRun)} candidates=${summary.candidates.length} totalBytes=${summary.totalCandidateBytes} discarded=${summary.discardedCount} deleted=${summary.deletedCount} failed=${summary.failedCount}\n`,
  );

  if (summary.failedCount > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("cleanup-upload-files.ts") || process.argv[1]?.endsWith("cleanup-upload-files.js")) {
  main().catch((error: unknown) => {
    process.stderr.write(`cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
