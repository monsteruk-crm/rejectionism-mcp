import "./lib/environment.mjs";

const args = process.argv.slice(2);
let origin = "http://localhost:3000";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--origin=")) {
    origin = arg.slice("--origin=".length);
  } else if (arg === "--origin" && i + 1 < args.length) {
    origin = args[i + 1];
  }
}

const password = process.env.CAMPAIGNOS_PASSWORD;
if (!password) {
  console.error("CAMPAIGNOS_PASSWORD is not set in the environment.");
  process.exit(1);
}

async function main() {
  const url = new URL("/api/readiness", origin);
  console.log(`Checking readiness at ${url.toString()}...`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${password}`,
      },
    });

    const status = response.status;
    const body = await response.json().catch(() => null);

    console.log(`HTTP Status: ${status}`);
    console.log("Readiness Report:", JSON.stringify(body, null, 2));

    if (response.ok && body && body.ok) {
      console.log("Readiness check passed.");
      process.exit(0);
    } else {
      console.error("Readiness check failed.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Failed to connect to readiness endpoint:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
