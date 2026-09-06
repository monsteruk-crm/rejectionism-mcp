import { describe, expect, it } from "vitest";
import { isExternalHttpUrl } from "@/lib/campaign/external-url";

describe("external URL validator", () => {
  it("accepts public http(s) URLs", () => {
    expect(isExternalHttpUrl("https://example.com/logo.png")).toBe(true);
    expect(isExternalHttpUrl("http://example.com")).toBe(true);
    expect(isExternalHttpUrl("https://drive.google.com/file/d/abc123/view")).toBe(true);
    expect(isExternalHttpUrl("https://example.com:8443/path?query=1#frag")).toBe(true);
    expect(isExternalHttpUrl("http://8.8.8.8/x")).toBe(true);
    expect(isExternalHttpUrl("http://172.32.0.1/x")).toBe(true); // outside 172.16/12
    expect(isExternalHttpUrl("http://[2001:db8::1]/x")).toBe(true);
    expect(isExternalHttpUrl("http://[::ffff:8.8.8.8]/x")).toBe(true);
  });

  it("rejects non-strings, empty values, and overlong values", () => {
    expect(isExternalHttpUrl(null)).toBe(false);
    expect(isExternalHttpUrl(undefined)).toBe(false);
    expect(isExternalHttpUrl(42)).toBe(false);
    expect(isExternalHttpUrl("")).toBe(false);
    expect(isExternalHttpUrl("   ")).toBe(false);
    expect(isExternalHttpUrl("https://example.com/" + "a".repeat(2048))).toBe(false);
  });

  it("rejects non-http(s) protocols and unparseable values", () => {
    expect(isExternalHttpUrl("ftp://example.com/file")).toBe(false);
    expect(isExternalHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isExternalHttpUrl("data:text/html,hi")).toBe(false);
    expect(isExternalHttpUrl("//example.com/x")).toBe(false);
    expect(isExternalHttpUrl("not a url")).toBe(false);
    expect(isExternalHttpUrl("http://")).toBe(false);
  });

  it("rejects credential-bearing URLs and control characters", () => {
    expect(isExternalHttpUrl("http://user:pass@example.com/")).toBe(false);
    expect(isExternalHttpUrl("http://user@example.com/")).toBe(false);
    expect(isExternalHttpUrl("https://example.com/\u0000")).toBe(false);
    expect(isExternalHttpUrl("https://ex\nample.com/")).toBe(false);
    expect(isExternalHttpUrl("https://example.com/x\u007f")).toBe(false);
  });

  it("rejects localhost and local-suffix hostnames", () => {
    expect(isExternalHttpUrl("http://localhost/")).toBe(false);
    expect(isExternalHttpUrl("http://LOCALHOST/x")).toBe(false);
    expect(isExternalHttpUrl("http://sub.localhost/")).toBe(false);
    expect(isExternalHttpUrl("http://service.local/")).toBe(false);
  });

  it("rejects loopback, private, and link-local IPv4 literals", () => {
    expect(isExternalHttpUrl("http://127.0.0.1/")).toBe(false);
    expect(isExternalHttpUrl("http://10.1.2.3/")).toBe(false);
    expect(isExternalHttpUrl("http://0.0.0.0/")).toBe(false);
    expect(isExternalHttpUrl("http://169.254.1.1/")).toBe(false);
    expect(isExternalHttpUrl("http://172.16.0.1/")).toBe(false);
    expect(isExternalHttpUrl("http://172.31.255.255/")).toBe(false);
    expect(isExternalHttpUrl("http://192.168.1.1/")).toBe(false);
  });

  it("rejects non-canonical IPv4 forms that normalize into loopback", () => {
    // WHATWG URL normalizes the decimal form to 127.0.0.1.
    expect(isExternalHttpUrl("http://2130706433/")).toBe(false);
    expect(isExternalHttpUrl("http://0x7f000001/")).toBe(false);
  });

  it("rejects loopback/private/link-local IPv6 literals", () => {
    expect(isExternalHttpUrl("http://[::1]/")).toBe(false);
    expect(isExternalHttpUrl("http://[::]/")).toBe(false);
    expect(isExternalHttpUrl("http://[fe80::1]/")).toBe(false);
    expect(isExternalHttpUrl("http://[fc00::1]/")).toBe(false);
    expect(isExternalHttpUrl("http://[fd12:3456::1]/")).toBe(false);
    expect(isExternalHttpUrl("http://[::ffff:127.0.0.1]/")).toBe(false);
    expect(isExternalHttpUrl("http://[::ffff:192.168.0.1]/")).toBe(false);
  });
});
