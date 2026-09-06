import { describe, it, expect } from "vitest";
import { SearchQuerySchema } from "@/lib/campaign/search-schemas";
import { escapeLikePattern } from "@/lib/campaign/search";

describe("Search Schemas & Helpers", () => {
  it("validates search query string length and boundaries", () => {
    expect(SearchQuerySchema.safeParse({ query: "launch" }).success).toBe(true);
    expect(SearchQuerySchema.safeParse({ query: "   " }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ query: "" }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ query: "a".repeat(201) }).success).toBe(false);
  });

  it("deduplicates entityTypes and tags", () => {
    const res = SearchQuerySchema.safeParse({
      query: "launch",
      entityTypes: ["WORK_ITEM", "ASSET", "WORK_ITEM"],
      tags: ["poster", "banner", "poster"],
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.entityTypes).toEqual(["WORK_ITEM", "ASSET"]);
      expect(res.data.tags).toEqual(["poster", "banner"]);
    }
  });

  it("escapes PostgreSQL LIKE wildcard characters", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("file_name")).toBe("file\\_name");
    expect(escapeLikePattern("back\\slash")).toBe("back\\\\slash");
    expect(escapeLikePattern("100%_pure\\clean")).toBe("100\\%\\_pure\\\\clean");
  });
});
