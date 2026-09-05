import { describe, it, expect } from "vitest";
import { toMcpToolResult } from "@/lib/mcp/tool-result";
import { ok, fail } from "@/lib/campaign/results";

describe("toMcpToolResult", () => {
  it("formats successful service result into structuredContent and text content", () => {
    const data = { count: 42, name: "test" };
    const res = ok(data);
    const mcpRes = toMcpToolResult(res, (d) => `Loaded ${d.count} items for ${d.name}`);

    expect(mcpRes.isError).toBeUndefined();
    expect(mcpRes.structuredContent).toEqual(data);
    expect(mcpRes.content[0].text).toBe("Loaded 42 items for test");
  });

  it("formats error service result with isError true and sanitized code/message", () => {
    const res = fail("VERSION_CONFLICT", "Version mismatch on update.");
    const mcpRes = toMcpToolResult(res);

    expect(mcpRes.isError).toBe(true);
    expect(mcpRes.content[0].text).toContain("[VERSION_CONFLICT] Version mismatch on update.");
  });

  it("includes fieldErrors in error output when present", () => {
    const res = fail("VALIDATION_ERROR", "Validation failed.", {
      title: ["Must not be empty."],
    });
    const mcpRes = toMcpToolResult(res);

    expect(mcpRes.isError).toBe(true);
    expect(mcpRes.content[0].text).toContain("[VALIDATION_ERROR]");
    expect(mcpRes.content[0].text).toContain("Must not be empty.");
  });
});
