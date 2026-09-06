import { describe, expect, it } from "vitest";
import { authenticateFileRequest } from "@/lib/auth/boundaries";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const VALID_TEST_PASSWORD = "a".repeat(32);

describe("private file retrieval authentication", () => {
  it("rejects unauthenticated requests with 401 and WWW-Authenticate", async () => {
    const req = {
      headers: new Headers(),
    };
    const outcome = await authenticateFileRequest(req);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(401);
      expect(outcome.response.headers.get("WWW-Authenticate")).toBe('Bearer realm="CampaignOS"');
      expect(outcome.response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("rejects invalid session cookies", async () => {
    const headers = new Headers();
    headers.set("cookie", `${SESSION_COOKIE_NAME}=invalid.tampered.cookie`);
    const req = { headers };
    const outcome = await authenticateFileRequest(req);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(401);
    }
  });

  it("authenticates requests with a valid signed session cookie", async () => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_TEST_PASSWORD;
    const cookieToken = createSessionToken();
    expect(cookieToken).not.toBeNull();
    const headers = new Headers();
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${cookieToken}`);
    const req = { headers };
    const outcome = await authenticateFileRequest(req);
    expect(outcome.ok).toBe(true);
  });

  it("rejects invalid Bearer tokens", async () => {
    const headers = new Headers();
    headers.set("authorization", "Bearer wrong-password-credential-not-matching");
    const req = { headers };
    const outcome = await authenticateFileRequest(req);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(401);
    }
  });

  it("authenticates requests with a valid CampaignOS Bearer credential", async () => {
    const headers = new Headers();
    headers.set("authorization", `Bearer ${VALID_TEST_PASSWORD}`);
    const req = { headers };
    const outcome = await authenticateFileRequest(req);
    expect(outcome.ok).toBe(true);
  });

  it("rejects upload capability tokens (Upload capabilities cannot download private files)", async () => {
    const headers = new Headers();
    headers.set("authorization", `Upload ${"A".repeat(43)}`);
    const req = { headers };
    const outcome = await authenticateFileRequest(req);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(401);
    }
  });
});
