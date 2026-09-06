/**
 * Next.js augments `process.env.NODE_ENV` as a readonly property, so tests
 * that need to exercise production-specific behavior toggle it through this
 * helper instead of assigning directly.
 */
export function setNodeEnv(value: string | undefined): void {
  const env = process.env as unknown as Record<string, string | undefined>;
  env.NODE_ENV = value;
}
