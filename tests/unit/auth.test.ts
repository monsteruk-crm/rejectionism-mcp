import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { setNodeEnv } from "./helpers/node-env";
import {
  getConfiguredPassword,
  isPasswordConfigValid,
  passwordMatches,
  bearerTokenMatches,
  LOGIN_INPUT_MAX_LENGTH,
} from "@/lib/auth/config";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";

const VALID_PASSWORD = "Abcd1234Efgh5678Ijkl9012Mnop3456"; // 32 chars of [A-Za-z0-9_-]

describe("auth config", () => {
  const original = process.env.CAMPAIGNOS_PASSWORD;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CAMPAIGNOS_PASSWORD;
    } else {
      process.env.CAMPAIGNOS_PASSWORD = original;
    }
  });

  it("accepts a password matching [A-Za-z0-9_-]{32,256}", () => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_PASSWORD;
    expect(getConfiguredPassword()).toBe(VALID_PASSWORD);
    expect(isPasswordConfigValid()).toBe(true);
  });

  it("rejects missing, short, and weak configuration without throwing", () => {
    delete process.env.CAMPAIGNOS_PASSWORD;
    expect(getConfiguredPassword()).toBeNull();
    expect(isPasswordConfigValid()).toBe(false);

    process.env.CAMPAIGNOS_PASSWORD = "short";
    expect(getConfiguredPassword()).toBeNull();

    process.env.CAMPAIGNOS_PASSWORD = "a".repeat(31);
    expect(getConfiguredPassword()).toBeNull();

    process.env.CAMPAIGNOS_PASSWORD = "a".repeat(257);
    expect(getConfiguredPassword()).toBeNull();

    // Characters outside the allowed class are rejected.
    process.env.CAMPAIGNOS_PASSWORD = `${"a".repeat(32)}!`;
    expect(getConfiguredPassword()).toBeNull();
  });

  it("never trims supplied passwords", () => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_PASSWORD;
    expect(passwordMatches(` ${VALID_PASSWORD}`)).toBe(false);
    expect(passwordMatches(`${VALID_PASSWORD} `)).toBe(false);
  });

  it("succeeds only for the exact credential", () => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_PASSWORD;
    expect(passwordMatches(VALID_PASSWORD)).toBe(true);
    expect(passwordMatches(`${VALID_PASSWORD}x`)).toBe(false);
    expect(passwordMatches(VALID_PASSWORD.slice(0, 31))).toBe(false);
    expect(passwordMatches("")).toBe(false);
  });

  it("handles arbitrary-length comparisons through fixed digests", () => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_PASSWORD;
    const longWrong = "b".repeat(LOGIN_INPUT_MAX_LENGTH + 50);
    expect(passwordMatches(longWrong)).toBe(false);
    expect(passwordMatches("a")).toBe(false);
  });

  it("fails closed when configuration is missing", () => {
    delete process.env.CAMPAIGNOS_PASSWORD;
    expect(passwordMatches(VALID_PASSWORD)).toBe(false);
    expect(bearerTokenMatches(VALID_PASSWORD)).toBe(false);
  });

  it("rejects a session cookie value used as an MCP bearer credential", () => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_PASSWORD;
    const token = createSessionToken();
    expect(token).not.toBeNull();
    expect(bearerTokenMatches(token as string)).toBe(false);
  });
});

describe("session tokens", () => {
  const original = process.env.CAMPAIGNOS_PASSWORD;

  beforeEach(() => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_PASSWORD;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CAMPAIGNOS_PASSWORD;
    } else {
      process.env.CAMPAIGNOS_PASSWORD = original;
    }
  });

  it("creates a v1 token with the exact payload shape", () => {
    const now = 1_700_000_000;
    const token = createSessionToken(now);
    expect(token).not.toBeNull();

    const parts = (token as string).split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("v1");

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "nonce", "v"]);
    expect(payload.v).toBe(1);
    expect(payload.iat).toBe(now);
    expect(payload.exp).toBe(now + SESSION_TTL_SECONDS);
    expect(payload.nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns null when signing is impossible without configuration", () => {
    delete process.env.CAMPAIGNOS_PASSWORD;
    expect(createSessionToken()).toBeNull();
  });

  it("verifies its own token", () => {
    const now = 1_700_000_000;
    const token = createSessionToken(now) as string;
    expect(verifySessionToken(token, now)).toEqual({ valid: true });
    expect(verifySessionToken(token, now + SESSION_TTL_SECONDS - 1).valid).toBe(true);
  });

  it("rejects missing, malformed, and oversized cookies", () => {
    expect(verifySessionToken(undefined).valid).toBe(false);
    expect(verifySessionToken("").valid).toBe(false);
    expect(verifySessionToken("not-a-token").valid).toBe(false);
    expect(verifySessionToken("v2.abc.def").valid).toBe(false);
    expect(verifySessionToken("v1.!!!.???").valid).toBe(false);
    expect(verifySessionToken(`v1.${"a".repeat(3000)}.${"b".repeat(100)}`).valid).toBe(false);
  });

  it("rejects tampered payloads and signatures", () => {
    const token = createSessionToken() as string;
    const [prefix, payload, signature] = token.split(".");

    const forgedPayload = Buffer.from(
      JSON.stringify({ v: 1, iat: 1, exp: 2 + SESSION_TTL_SECONDS, nonce: "aaaa" }),
    ).toString("base64url");
    expect(verifySessionToken(`${prefix}.${forgedPayload}.${signature}`).valid).toBe(false);

    const forgedSignature = Buffer.alloc(32, 7).toString("base64url");
    expect(verifySessionToken(`${prefix}.${payload}.${forgedSignature}`).valid).toBe(false);
  });

  it("rejects expired and future-issued cookies", () => {
    const now = 1_700_000_000;
    const token = createSessionToken(now) as string;

    expect(verifySessionToken(token, now + SESSION_TTL_SECONDS).reason).toBe("expired");
    expect(verifySessionToken(token, now - 61).reason).toBe("future_iat");
    // Within the 60-second clock skew the token remains valid.
    expect(verifySessionToken(token, now - 60).valid).toBe(true);
  });

  it("rejects payloads with wrong shapes or wrong expiry arithmetic", () => {
    const signingKey = createHmac("sha256", VALID_PASSWORD)
      .update("campaignos:admin-session:v1")
      .digest();

    const sign = (payloadJson: string) => {
      const payloadB64 = Buffer.from(payloadJson).toString("base64url");
      const signature = createHmac("sha256", signingKey).update(`v1.${payloadB64}`).digest();
      return `v1.${payloadB64}.${signature.toString("base64url")}`;
    };

    const now = 1_700_000_000;

    // Wrong exp arithmetic.
    const wrongExpiry = sign(
      JSON.stringify({ v: 1, iat: now, exp: now + 60, nonce: "aaaa" }),
    );
    expect(verifySessionToken(wrongExpiry, now).reason).toBe("bad_payload");

    // Extra property.
    const extraKeys = sign(
      JSON.stringify({ v: 1, iat: now, exp: now + SESSION_TTL_SECONDS, nonce: "aaaa", admin: true }),
    );
    expect(verifySessionToken(extraKeys, now).reason).toBe("bad_payload");

    // Non-integer iat.
    const floatIat = sign(
      JSON.stringify({ v: 1, iat: now + 0.5, exp: now + 0.5 + SESSION_TTL_SECONDS, nonce: "aaaa" }),
    );
    expect(verifySessionToken(floatIat, now).reason).toBe("bad_payload");

    // Wrong version.
    const wrongVersion = sign(
      JSON.stringify({ v: 2, iat: now, exp: now + SESSION_TTL_SECONDS, nonce: "aaaa" }),
    );
    expect(verifySessionToken(wrongVersion, now).reason).toBe("bad_payload");
  });

  it("invalidates existing cookies after password rotation", () => {
    const now = 1_700_000_000;
    const token = createSessionToken(now) as string;
    expect(verifySessionToken(token, now).valid).toBe(true);

    process.env.CAMPAIGNOS_PASSWORD = "Zyxw9876Vuts5432Rqpo1098Nmlk7654";
    expect(verifySessionToken(token, now).valid).toBe(false);
    expect(verifySessionToken(token, now).reason).toBe("bad_signature");
  });

  it("uses HttpOnly SameSite=Lax cookies, Secure in production, and expires on logout", () => {
    const originalEnv = process.env.NODE_ENV;

    setNodeEnv("production");
    const prodOptions = sessionCookieOptions();
    expect(prodOptions.httpOnly).toBe(true);
    expect(prodOptions.sameSite).toBe("lax");
    expect(prodOptions.secure).toBe(true);
    expect(prodOptions.path).toBe("/");
    expect(prodOptions.maxAge).toBe(SESSION_TTL_SECONDS);

    setNodeEnv("development");
    const devOptions = sessionCookieOptions();
    expect(devOptions.secure).toBe(false);

    // Logout expires the identical cookie.
    const logoutOptions = sessionCookieOptions(0);
    expect(logoutOptions.maxAge).toBe(0);
    expect(logoutOptions.httpOnly).toBe(true);

    setNodeEnv(originalEnv);
  });

  it("names the session cookie exactly campaignos_session", () => {
    expect(SESSION_COOKIE_NAME).toBe("campaignos_session");
  });
});
