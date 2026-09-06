import { z } from "zod";
import { AssetStatusSchema } from "./schemas";
import { isExternalHttpUrl } from "./external-url";

/**
 * Strict input schemas for the focused asset service APIs (upgrade plan
 * section 4 notation, section 7 asset rules).
 *
 * This module is intentionally free of "server-only" so browser-safe admin
 * forms can reuse the same validators in later phases. Everything is strict:
 * unknown keys are rejected, omission preserves, explicit null clears.
 */

// Section 4 notation primitives.
export const AssetIdSchema = z.string().trim().min(1, "Must not be empty.").max(100, "Must not exceed 100 characters.");
export const AssetTextSchema = z.string().trim().min(1, "Must not be empty.").max(200, "Must not exceed 200 characters.");
export const AssetNotesSchema = z
  .string()
  .trim()
  .max(20000, "Must not exceed 20000 characters.")
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value));
export const AssetVersionSchema = z.coerce.number().int().min(1, "Version must be a positive integer.");
export const AssetHttpUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL must not exceed 2048 characters.")
  .refine((value) => isExternalHttpUrl(value), {
    message: "Must be a public http(s) URL without credentials and without a local destination.",
  });
const SourceFilenameSchema = z
  .string()
  .trim()
  .min(1, "Must not be empty.")
  .max(255, "Must not exceed 255 characters.")
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value));

// RepresentationFields: descriptive metadata only; technical fields are owned
// by server-side verification and are never accepted from clients.
export const RepresentationFieldsSchema = z
  .object({
    label: AssetTextSchema.optional().nullable(),
    notes: AssetNotesSchema,
    variant: AssetTextSchema.optional().nullable(),
    format: AssetTextSchema.optional().nullable(),
    sourceFilename: SourceFilenameSchema,
  })
  .strict();

export const ExternalRepresentationInputSchema = RepresentationFieldsSchema.extend({
  externalUrl: AssetHttpUrlSchema,
}).strict();

export interface ExternalRepresentationInput extends z.infer<typeof ExternalRepresentationInputSchema> {}

// AssetMetadata: conceptual asset identity and workflow status.
export const AssetMetadataSchema = z
  .object({
    id: AssetIdSchema.optional().nullable(),
    name: AssetTextSchema,
    kind: AssetTextSchema,
    status: AssetStatusSchema.default("DRAFT"),
    notes: AssetNotesSchema,
  })
  .strict();

export interface AssetMetadataInput extends z.infer<typeof AssetMetadataSchema> {}

export const AssetDetailChangesSchema = z
  .object({
    name: AssetTextSchema.optional(),
    kind: AssetTextSchema.optional(),
    status: AssetStatusSchema.optional(),
    notes: AssetNotesSchema.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "At least one field must be provided in changes.",
  });

export const CreateAssetDetailInputSchema = AssetMetadataSchema;

export const UpdateAssetDetailInputSchema = z
  .object({
    id: AssetIdSchema,
    expectedVersion: AssetVersionSchema,
    changes: AssetDetailChangesSchema,
  })
  .strict();

export const AddExternalAssetInputSchema = z
  .object({
    asset: AssetMetadataSchema,
    representation: ExternalRepresentationInputSchema,
  })
  .strict();

export const CreateAssetRevisionInputSchema = z
  .object({
    assetId: AssetIdSchema,
    expectedVersion: AssetVersionSchema,
    label: AssetTextSchema.optional().nullable(),
    notes: AssetNotesSchema,
  })
  .strict();

export const AddAssetRepresentationInputSchema = z
  .object({
    assetRevisionId: AssetIdSchema,
    expectedVersion: AssetVersionSchema,
    representation: ExternalRepresentationInputSchema,
  })
  .strict();

export const SetPrimaryAssetRepresentationInputSchema = z
  .object({
    representationId: AssetIdSchema,
    expectedVersion: AssetVersionSchema,
  })
  .strict();

export type CreateAssetRevisionInput = z.infer<typeof CreateAssetRevisionInputSchema>;
export type AddAssetRepresentationInput = z.infer<typeof AddAssetRepresentationInputSchema>;
export type SetPrimaryAssetRepresentationInput = z.infer<typeof SetPrimaryAssetRepresentationInputSchema>;
export type UpdateAssetDetailInput = z.infer<typeof UpdateAssetDetailInputSchema>;
export type AddExternalAssetInput = z.infer<typeof AddExternalAssetInputSchema>;
