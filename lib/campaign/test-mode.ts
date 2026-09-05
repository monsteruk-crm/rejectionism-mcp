import "server-only";

export function isTestModeEnabled(): boolean {
  return process.env.UNAUTHENTICATED_TEST_MODE === "true";
}

export const TEST_MODE_WARNING =
  "UNAUTHENTICATED TEST SYSTEM — DO NOT STORE PRIVATE OR SENSITIVE DATA";
