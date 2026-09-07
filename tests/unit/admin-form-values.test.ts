import { describe, it, expect } from "vitest";
import { extractWhitelistedFormFields } from "../../lib/admin/form-values";

describe("lib/admin/form-values.ts", () => {
  it("extracts only whitelisted fields and ignores framework $ACTION_* fields", () => {
    const formData = new FormData();
    formData.append("$ACTION_ID_123", "secret_action");
    formData.append("title", "Test Title");
    formData.append("description", "Test Description");
    formData.append("extraField", "Should be ignored");

    const extracted = extractWhitelistedFormFields(formData, ["title", "description"]);
    expect(extracted).toEqual({
      title: "Test Title",
      description: "Test Description",
    });
    expect((extracted as any).$ACTION_ID_123).toBeUndefined();
    expect((extracted as any).extraField).toBeUndefined();
  });

  it("converts empty strings on nullable fields to null", () => {
    const formData = new FormData();
    formData.append("title", "Test");
    formData.append("blockedReason", "   ");
    formData.append("evidenceUrl", "");

    const extracted = extractWhitelistedFormFields(
      formData,
      ["title", "blockedReason", "evidenceUrl"],
      {
        nullableFields: ["blockedReason", "evidenceUrl"],
      },
    );

    expect(extracted.title).toBe("Test");
    expect(extracted.blockedReason).toBeNull();
    expect(extracted.evidenceUrl).toBeNull();
  });

  it("preserves empty string on emptyStringFields (e.g. work item description)", () => {
    const formData = new FormData();
    formData.append("title", "Test");
    formData.append("description", "   ");

    const extracted = extractWhitelistedFormFields(
      formData,
      ["title", "description"],
      {
        emptyStringFields: ["description"],
      },
    );

    expect(extracted.title).toBe("Test");
    expect(extracted.description).toBe("");
  });

  it("parses numbers and ISO dates correctly", () => {
    const formData = new FormData();
    formData.append("priority", "42");
    formData.append("dueDate", "2026-09-07T12:00");

    const extracted = extractWhitelistedFormFields(
      formData,
      ["priority", "dueDate"],
      {
        numberFields: ["priority"],
        isoDateFields: ["dueDate"],
      },
    );

    expect(extracted.priority).toBe(42);
    expect(typeof extracted.dueDate).toBe("string");
    expect(new Date(extracted.dueDate as string).toISOString()).toBe(extracted.dueDate);
  });
});
