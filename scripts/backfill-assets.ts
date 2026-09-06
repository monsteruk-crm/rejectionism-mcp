import "dotenv/config";
import { backfillLegacyAssets } from "../lib/campaign/asset-backfill";

async function main() {
  console.log("Starting legacy asset reference backfill...");

  const result = await backfillLegacyAssets();

  if (!result.ok) {
    console.error(`Backfill failed [${result.error.code}]: ${result.error.message}`);
    if (result.error.fieldErrors) {
      console.error("Field errors:", result.error.fieldErrors);
    }
    process.exitCode = 1;
    return;
  }

  const summary = result.data;
  console.log("Backfill completed successfully (counts only):");
  console.log(`  - Assets scanned:              ${summary.totalAssets}`);
  console.log(`  - Revision 1 rows created:     ${summary.revisionsCreated}`);
  console.log(`  - Representations migrated:    ${summary.representationsCreated}`);
  console.log(`  - Already migrated (skipped):  ${summary.alreadyMigrated}`);
  console.log(`  - Without legacy URL:          ${summary.withoutLegacyUrl}`);
  console.log(`  - Invalid URLs (untouched):    ${summary.invalidUrls}`);
  console.log(
    "No URLs or notes are printed by design. Repeat runs are idempotent and never update migrated representations.",
  );
}

main().catch((err) => {
  console.error("Unexpected error during asset backfill execution:", err);
  process.exitCode = 1;
});
