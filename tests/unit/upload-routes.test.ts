import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  extractUploadCapability,
  mapServiceCodeToHttpStatus,
  parseBoundedJsonBody,
  errorJsonResponse,
  serviceErrorResponse,
} from "@/lib/uploads/capability-auth";
import { DEFAULT_BASE_URL } from "@/lib/auth/origin";
import { authenticateUploadRequest } from "@/lib/uploads/upload-auth";

describe("upload capability extraction and origin guard", () => {
  it("allows a missing Origin only for explicitly configured read recovery", async () => {
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/status`, {
      method: "GET",
      headers: { authorization: "Upload short-token" },
    });
    const outcome = await authenticateUploadRequest(req, { allowMissingOrigin: true });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(401);
    }

    const crossOriginReq = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/status`, {
      method: "GET",
      headers: {
        origin: "https://evil.example.com",
        authorization: "Upload short-token",
      },
    });
    const crossOriginOutcome = await authenticateUploadRequest(crossOriginReq, {
      allowMissingOrigin: true,
    });
    expect(crossOriginOutcome.ok).toBe(false);
    if (!crossOriginOutcome.ok) {
      expect(crossOriginOutcome.response.status).toBe(403);
    }
  });

  it("rejects missing origin for browser upload requests", () => {
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        authorization: `Upload ${"A".repeat(43)}`,
      },
    });
    const outcome = extractUploadCapability(req);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(403);
    }
  });

  it("rejects mismatched origin", () => {
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        authorization: `Upload ${"A".repeat(43)}`,
      },
    });
    const outcome = extractUploadCapability(req);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(403);
    }
  });

  it("rejects missing or malformed authorization header", () => {
    const noAuth = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: { origin: DEFAULT_BASE_URL },
    });
    expect(extractUploadCapability(noAuth).ok).toBe(false);

    const bearerAuth = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        origin: DEFAULT_BASE_URL,
        authorization: "Bearer some-token",
      },
    });
    expect(extractUploadCapability(bearerAuth).ok).toBe(false);

    const invalidToken = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        origin: DEFAULT_BASE_URL,
        authorization: "Upload short-token",
      },
    });
    const outcome = extractUploadCapability(invalidToken);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(401);
    }
  });

  it("accepts same-origin requests with a valid 43-character token", () => {
    const validToken = "A".repeat(43);
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        origin: DEFAULT_BASE_URL,
        authorization: `Upload ${validToken}`,
      },
    });
    const outcome = extractUploadCapability(req);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.token).toBe(validToken);
    }
  });
});

describe("bounded JSON body parsing", () => {
  it("rejects non-JSON content types with 415", async () => {
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: "plain text",
    });
    const outcome = await parseBoundedJsonBody(req, 1024);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(415);
    }
  });

  it("rejects empty body with 400", async () => {
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });
    const outcome = await parseBoundedJsonBody(req, 1024);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(400);
    }
  });

  it("rejects bodies exceeding the byte cap with 413", async () => {
    const largeData = JSON.stringify({ data: "x".repeat(2000) });
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: largeData,
    });
    const outcome = await parseBoundedJsonBody(req, 1024);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(413);
    }
  });

  it("rejects invalid JSON syntax with 400", async () => {
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{ not valid json",
    });
    const outcome = await parseBoundedJsonBody(req, 1024);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(400);
    }
  });

  it("parses valid JSON within the byte cap", async () => {
    const req = new NextRequest(`${DEFAULT_BASE_URL}/api/uploads/prepare`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ key: "value", number: 42 }),
    });
    const outcome = await parseBoundedJsonBody<{ key: string; number: number }>(req, 1024);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.key).toBe("value");
      expect(outcome.data.number).toBe(42);
    }
  });
});

describe("HTTP status code and security headers mapping", () => {
  it("maps service error codes to exact expected HTTP statuses", () => {
    expect(mapServiceCodeToHttpStatus("VALIDATION_ERROR")).toBe(422);
    expect(mapServiceCodeToHttpStatus("UPLOAD_FILE_REJECTED")).toBe(422);
    expect(mapServiceCodeToHttpStatus("UPLOAD_LIMIT_EXCEEDED")).toBe(422);
    expect(mapServiceCodeToHttpStatus("NOT_FOUND")).toBe(404);
    expect(mapServiceCodeToHttpStatus("UPLOAD_EXPIRED")).toBe(410);
    expect(mapServiceCodeToHttpStatus("UPLOAD_REVOKED")).toBe(410);
    expect(mapServiceCodeToHttpStatus("UPLOAD_ALREADY_SUBMITTED")).toBe(409);
    expect(mapServiceCodeToHttpStatus("VERSION_CONFLICT")).toBe(409);
    expect(mapServiceCodeToHttpStatus("ALREADY_EXISTS")).toBe(409);
    expect(mapServiceCodeToHttpStatus("UPLOAD_NOT_READY")).toBe(409);
    expect(mapServiceCodeToHttpStatus("DATABASE_UNAVAILABLE")).toBe(503);
    expect(mapServiceCodeToHttpStatus("STORAGE_UNAVAILABLE")).toBe(503);
    expect(mapServiceCodeToHttpStatus("AUTH_NOT_CONFIGURED")).toBe(503);
    expect(mapServiceCodeToHttpStatus("INTERNAL_ERROR")).toBe(500);
  });

  it("attaches security headers to error responses", () => {
    const res = errorJsonResponse("TEST_ERROR", "Test message", 400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("formats service errors with fieldErrors", async () => {
    const res = serviceErrorResponse({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      fieldErrors: { name: ["Required"] },
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors).toEqual({ name: ["Required"] });
  });
});
