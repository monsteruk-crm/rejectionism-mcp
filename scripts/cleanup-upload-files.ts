import { config } from "dotenv";
import { runUploadCleanup } from "../lib/campaign/upload-cleanup";
import { getStorageProvider } from "../lib/storage/vercel-blob";

/**
 * Abandoned upload-file cleanup CLI (upgrade plan section 6, "Abandoned
 * file cleanup").
 *
 * - Defaults to a dry run that only reports candidates.
 * - `--apply` is required to actually discard and delete.
 * - Logs IDs and counts only — never tokens, hashes, or URLs.
 * - There is no HTTP/MCP cleanup endpoint and no scheduler; this script is
 *   the only entry point.
 */

config({ path: ".env.local" });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const limitIndex = args.indexOf("--limit");
const limit =
  limitIndex !== -1 && args[limitIndex + 1] !== undefined
    ? Number.parseInt(args[limitIndex + 1] ?? "", 10)
    : undefined;

async function main(): Promise<void> {
  if (apply) {
    process.stdout.write(
      "Cleanup is running with --apply: eligible unreferenced upload files will be discarded and deleted from the private blob store.\n",
    );
  } else {
    process.stdout.write(
      "Dry run (default): reporting candidates only. Pass --apply to discard and delete.\n",
    );
  }

  const summary = await runUploadCleanup({
    apply,
    provider: getStorageProvider(),
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  for (const candidate of summary.candidates) {
    process.stdout.write(
      `candidate id=${candidate.id} requestStatus=${candidate.requestStatus} fileStatus=${candidate.fileStatus}\n`,
    );
  }

  process.stdout.write(
    `done dryRun=${String(summary.dryRun)} candidates=${summary.candidates.length} discarded=${summary.discardedCount} deleted=${summary.deletedCount} failed=${summary.failedCount}\n`,
  );

  if (summary.failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
