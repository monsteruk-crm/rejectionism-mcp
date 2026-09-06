import { z } from "zod";
import { TagSlugSchema, OriginalEntityTypeSchema, OriginalEntityType } from "./tag-schemas";

/**
 * Strict search input schema and DTO types (upgrade plan section 4 tool 42).
 */

export const SearchQuerySchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1, "Search query must not be empty.")
      .max(200, "Search query must not exceed 200 characters."),
    entityTypes: z
      .array(OriginalEntityTypeSchema)
      .min(1)
      .max(7)
      .optional()
      .transform((val) => (val ? ([...new Set(val)] as OriginalEntityType[]) : undefined)),
    tags: z
      .array(TagSlugSchema)
      .min(1)
      .max(10)
      .optional()
      .transform((val) => (val ? ([...new Set(val)] as string[]) : undefined)),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export interface SearchResultDto {
  entityType: OriginalEntityType;
  id: string;
  title: string;
  snippet: string;
  status: string | null;
  tags: string[];
  updatedAt: string;
  href: string;
}

export interface SearchOutputDto {
  items: SearchResultDto[];
  total: number;
  limit: number;
  offset: number;
}
