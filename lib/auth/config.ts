import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Server-only authentication configuration.
 *
 * The single shared credential (CAMPAIGNOS_PASSWORD) serves as both the admin
 * password and the MCP Bearer secret. Missing or invalid configuration fails
 * closed at request time; it never throws during module import.
 */

const PASSWORD_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export const PASSWORD_MIN_LENGTH = 32;
export const PASSWORD_MAX_LENGTH = 256;
export const LOGIN_INPUT_MAX_LENGTH = 256;

export function getConfiguredPassword(): string | null {
  const password = process.env.CAMPAIGNOS_PASSWORD;

  if (typeof password !== "string" || !PASSWORD_PATTERN.test(password)) {
    return null;
  }

  return password;
}

export function isPasswordConfigValid(): boolean {
  return getConfiguredPassword() !== null;
}

/**
 * Constant-time credential comparison through fixed-length SHA-256 digests.
 * The supplied value is never trimmed and never echoed back.
 */
export function passwordMatches(supplied: string): boolean {
  if (typeof supplied !== "string" || supplied.length === 0) {
    return false;
  }

  const configured = getConfiguredPassword();
  if (configured === null) {
    return false;
  }

  const suppliedDigest = createHash("sha256").update(supplied, "utf8").digest();
  const configuredDigest = createHash("sha256").update(configured, "utf8").digest();

  return timingSafeEqual(suppliedDigest, configuredDigest);
}

/**
 * Bearer token comparison for MCP transport authentication. The upload
 * capability token is NOT an MCP credential and must never match here.
 */
export function bearerTokenMatches(supplied: string | null | undefined): boolean {
  if (typeof supplied !== "string" || supplied.length === 0) {
    return false;
  }

  return passwordMatches(supplied);
}
