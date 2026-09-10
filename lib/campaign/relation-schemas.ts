import { z } from "zod";
import {
  EntityIdSchema,
  EntityRefSchema,
  CampaignEntityTypeSchema,
  type EntityRef,
} from "./tag-schemas";

// Local copy of relation notes validation (browser-safe, no server-only chain):
// identical trim behaviour and limits to AssetNotesSchema without importing the
// asset-server-only barrel into client components.
const MAX_NOTES = 20000;

export const RelationNotesSchema = z
  .string()
  .trim()
  .max(MAX_NOTES, `Must not exceed ${MAX_NOTES} characters.`)
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v));

/**
 * Browser-safe schemas for directed relationships (upgrade plan section 4,
 * tools 39-41). Relations are directed and typed; reverse records are never
 * fabricated. Relation notes are immutable after creation.
 */

export const EntityRelationTypeSchema = z.enum(["RELATES_TO", "USES_ASSET", "PART_OF"]);
export type EntityRelationType = z.infer<typeof EntityRelationTypeSchema>;

export const GetRelationshipsQuerySchema = z
  .object({
    entityType: CampaignEntityTypeSchema,
    entityId: EntityIdSchema,
    direction: z.enum(["incoming", "outgoing", "both"]).default("both"),
    relationType: EntityRelationTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();

export const LinkEntitiesInputSchema = z
  .object({
    from: EntityRefSchema,
    to: EntityRefSchema,
    relationType: EntityRelationTypeSchema,
    notes: RelationNotesSchema,
  })
  .strict();

export const UnlinkEntitiesInputSchema = z
  .object({
    relationId: EntityIdSchema,
  })
  .strict();

export interface RelationDto {
  id: string;
  from: EntityRef;
  to: EntityRef;
  relationType: EntityRelationType;
  notes: string | null;
  createdAt: string;
  fromTitle: string;
  toTitle: string;
  fromHref: string;
  toHref: string;
}

/** Relation read relative to the requested entity (campaign_get_relationships). */
export type DirectedRelationDto = RelationDto & { direction: "incoming" | "outgoing" };
