import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setNodeEnv } from "./helpers/node-env";

// Mock Next.js server modules so the boundary modules can be imported in unit tests.
const cookiesStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookiesStore.has(name) ? { name, value: cookiesStore.get(name) } : undefined,
  })),
  headers: vi.fn(async () => new Map<string, string>()),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/server", () => {
  class NextResponse {
    private _body: unknown;
    private _status: number;
    private _headers: Record<string, string>;
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body;
      this._status = init?.status ?? 200;
      this._headers = init?.headers ?? {};
    }
    get status() {
      return this._status;
    }
    get headers() {
      return {
        get: (name: string) => {
          const lower = name.toLowerCase();
          const match = Object.entries(this._headers).find(
            ([key]) => key.toLowerCase() === lower,
          );
          return match?.[1] ?? null;
        },
      };
    }
    async json() {
      return this._body;
    }
    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new NextResponse(body, init);
    }
  }
  return { NextResponse };
});

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(),
}));

import { checkOrigin, getTrustedOrigin, validateConfiguredBaseUrl } from "@/lib/auth/origin";
import {
  authenticateMcpRequest,
  hasAdminSession,
  requireAdminAction,
  requireAdminPage,
  mcpUnauthorizedResponse,
} from "@/lib/auth/boundaries";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getHealthStatus, pingDatabase } from "@/lib/campaign/health";
import { getPrisma } from "@/lib/prisma";

const VALID_PASSWORD = "Abcd1234Efgh5678Ijkl9012Mnop3456";

function mockPrisma(impl: () => Promise<unknown>) {
  (getPrisma as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    $queryRaw: impl,
  }));
}

describe("configured base URL", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    setNodeEnv(originalEnv);
    delete process.env.CAMPAIGNOS_BASE_URL;
  });

  it("defaults to localhost outside production and fails closed in production", () => {
    setNodeEnv("development");
    expect(validateConfiguredBaseUrl(undefined)).toEqual({
      valid: true,
      origin: "http://localhost:3000",
    });

    setNodeEnv("production");
    expect(validateConfiguredBaseUrl(undefined).valid).toBe(false);
  });

  it("rejects credentials, paths, queries, fragments, and wrong schemes", () => {
    setNodeEnv("development");
    expect(validateConfiguredBaseUrl("http://user:pass@example.com").valid).toBe(false);
    expect(validateConfiguredBaseUrl("https://example.com/app").valid).toBe(false);
    expect(validateConfiguredBaseUrl("https://example.com/?x=1").valid).toBe(false);
    expect(validateConfiguredBaseUrl("https://example.com/#frag").valid).toBe(false);
    expect(validateConfiguredBaseUrl("ftp://example.com").valid).toBe(false);
    expect(validateConfiguredBaseUrl("not a url").valid).toBe(false);
  });

  it("requires HTTPS in production, including loopback hosts", () => {
    setNodeEnv("production");
    expect(validateConfiguredBaseUrl("http://example.com").reason).toBe("insecure_production");
    expect(validateConfiguredBaseUrl("http://localhost:3000").reason).toBe(
      "loopback_in_production",
    );
    expect(validateConfiguredBaseUrl("https://example.com").valid).toBe(true);
  });

  it("exposes the trusted origin or null", () => {
    setNodeEnv("development");
    delete process.env.CAMPAIGNOS_BASE_URL;
    expect(getTrustedOrigin()).toBe("http://localhost:3000");

    process.env.CAMPAIGNOS_BASE_URL = "https://campaignos.example.org";
    expect(getTrustedOrigin()).toBe("https://campaignos.example.org");

    setNodeEnv("production");
    process.env.CAMPAIGNOS_BASE_URL = "http://example.com";
    expect(getTrustedOrigin()).toBeNull();
  });
});

describe("same-origin guard", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    setNodeEnv("development");
    process.env.CAMPAIGNOS_BASE_URL = "https://campaignos.example.org";
  });

  afterEach(() => {
    setNodeEnv(originalEnv);
    delete process.env.CAMPAIGNOS_BASE_URL;
  });

  it("allows matching origins", () => {
    expect(checkOrigin("https://campaignos.example.org", "browser")).toBe("allowed");
  });

  it("rejects cross-origin, forged, and unparseable origins", () => {
    expect(checkOrigin("https://evil.example.net", "browser")).toBe("rejected");
    expect(checkOrigin("https://campaignos.example.org.evil.net", "browser")).toBe("rejected");
    expect(checkOrigin("not a url", "browser")).toBe("rejected");
  });

  it("rejects a missing Origin for cookie-authenticated endpoints but allows it for MCP", () => {
    expect(checkOrigin(null, "browser")).toBe("rejected");
    expect(checkOrigin(null, "mcp")).toBe("allowed");
    expect(checkOrigin(null, "action")).toBe("allowed");
  });

  it("rejects everything when the configured origin is invalid", () => {
    setNodeEnv("production");
    process.env.CAMPAIGNOS_BASE_URL = "http://example.com";
    expect(checkOrigin("http://example.com", "mcp")).toBe("rejected");
  });
});

describe("MCP transport authentication", () => {
  const original = process.env.CAMPAIGNOS_PASSWORD;

  beforeEach(() => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_PASSWORD;
    setNodeEnv("development");
    process.env.CAMPAIGNOS_BASE_URL = "https://campaignos.example.org";
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CAMPAIGNOS_PASSWORD;
    } else {
      process.env.CAMPAIGNOS_PASSWORD = original;
    }
    delete process.env.CAMPAIGNOS_BASE_URL;
  });

  function requestWith(headers: Record<string, string>) {
    return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } };
  }

  it("accepts the correct bearer credential", async () => {
    const outcome = await authenticateMcpRequest(
      requestWith({ authorization: `Bearer ${VALID_PASSWORD}` }),
    );
    expect(outcome.ok).toBe(true);
  });

  it("rejects missing, malformed, and wrong credentials with a 401 challenge", async () => {
    for (const headers of [
      {},
      { authorization: `Basic ${VALID_PASSWORD}` },
      { authorization: "Bearer wrong-password-wrong-password-wrong" },
      { authorization: "Bearer" },
    ]) {
      const outcome = await authenticateMcpRequest(requestWith(headers as Record<string, string>));
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.response.status).toBe(401);
        expect(outcome.response.headers.get("WWW-Authenticate")).toBe('Bearer realm="CampaignOS"');
        expect(outcome.response.headers.get("Cache-Control")).toBe("no-store");
        const body = await outcome.response.json();
        expect(body.error.message).not.toContain(VALID_PASSWORD);
      }
    }
  });

  it("rejects cross-origin MCP requests even with a valid credential", async () => {
    const outcome = await authenticateMcpRequest(
      requestWith({
        authorization: `Bearer ${VALID_PASSWORD}`,
        origin: "https://evil.example.net",
      }),
    );
    expect(outcome.ok).toBe(false);
  });

  it("rejects the session cookie value as an MCP credential", async () => {
    const token = createSessionToken() as string;
    const outcome = await authenticateMcpRequest(
      requestWith({ authorization: `Bearer ${token}` }),
    );
    expect(outcome.ok).toBe(false);
  });

  it("builds a standalone 401 challenge response", () => {
    const response = mcpUnauthorizedResponse();
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe('Bearer realm="CampaignOS"');
  });
});

describe("admin session boundaries", () => {
  beforeEach(() => {
    process.env.CAMPAIGNOS_PASSWORD = VALID_PASSWORD;
    setNodeEnv("development");
    delete process.env.CAMPAIGNOS_BASE_URL;
    cookiesStore.clear();
  });

  it("reports no session without a cookie", async () => {
    expect(await hasAdminSession()).toBe(false);
  });

  it("reports a session for a valid cookie", async () => {
    const token = createSessionToken() as string;
    cookiesStore.set(SESSION_COOKIE_NAME, token);
    expect(await hasAdminSession()).toBe(true);
  });

  it("redirects pages and actions to /login without a session", async () => {
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/login");
    await expect(requireAdminAction()).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects cross-origin actions before the session check", async () => {
    process.env.CAMPAIGNOS_BASE_URL = "https://campaignos.example.org";
    const headersModule = await import("next/headers");
    (headersModule.headers as ReturnType<typeof vi.fn>).mockImplementation(
      async () =>
        new Map([["origin", "https://evil.example.net"]]),
    );

    await expect(requireAdminAction()).rejects.toThrow("Cross-origin request rejected.");
  });
});

describe("health service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports ok when SELECT 1 succeeds", async () => {
    mockPrisma(async () => [{ result: 1 }]);
    expect(await getHealthStatus()).toEqual({ status: "ok" });
    expect(await pingDatabase()).toMatchObject({ ok: true });
  });

  it("reports degraded when the query fails or times out", async () => {
    mockPrisma(async () => {
      throw new Error("Can't reach database");
    });
    expect(await getHealthStatus()).toEqual({ status: "degraded" });
    expect(await pingDatabase()).toMatchObject({ ok: false });

    mockPrisma(async () => {
      throw new Error("Connection terminated");
    });
    const result = await getHealthStatus();
    expect(result.status).toBe("degraded");
  });

  it("reports degraded on unexpected result shapes", async () => {
    mockPrisma(async () => [{ result: 0 }]);
    expect(await getHealthStatus()).toEqual({ status: "degraded" });
  });
});
