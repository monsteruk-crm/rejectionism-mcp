import "dotenv/config";
import { seedCampaignData } from "../lib/campaign/seed";

async function main() {
  console.log("Starting Rejectionism CampaignOS database seed...");

  const result = await seedCampaignData();

  if (!result.ok) {
    console.error(`Seed failed [${result.error.code}]: ${result.error.message}`);
    if (result.error.fieldErrors) {
      console.error("Field errors:", result.error.fieldErrors);
    }
    process.exitCode = 1;
    return;
  }

  const { canon, websites, workItems, assets } = result.data;
  console.log("Seed completed successfully:");
  console.log(
    `  - Canon entries: ${canon.created} created, ${canon.updated} updated, ${canon.unchanged} unchanged`,
  );
  console.log(
    `  - Websites:      ${websites.created} created, ${websites.updated} updated, ${websites.unchanged} unchanged`,
  );
  console.log(
    `  - Work items:    ${workItems.created} created, ${workItems.updated} updated, ${workItems.unchanged} unchanged`,
  );
  console.log(
    `  - Assets:        ${assets.created} created, ${assets.updated} updated, ${assets.unchanged} unchanged`,
  );
}

main().catch((err) => {
  console.error("Unexpected error during seed execution:", err);
  process.exitCode = 1;
});
