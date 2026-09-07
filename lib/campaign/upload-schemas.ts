import { z } from "zod";
import { isAllowedMimeType, maxBytesForMimeType, sanitizeUploadFilename } from "./file-validation";
import { isExternalHttpUrl } from "./external-url";

/**
 * Strict input schemas for the upload services (upgrade plan section 6,
 * "Creation and token lifecycle", "Preparation and Blob authorization", and
 * "Finalization input and hashing").
 *
 * This module is intentionally free of "server-only" so browser-safe admin
 * forms can reuse the same validators in later phases. Everything is strict:
 * unknown keys are rejected, and technical file metadata is never accepted
 * from clients.
 */

export const UploadIdSchema = z.string().trim().min(1, "Must not be empty.").max(100, "Must not exceed 100 characters.");
export const UploadTextSchema = z.string().trim().min(1, "Must not be empty.").max(200, "Must not exceed 200 characters.");
export const UploadNotesSchema = z
  .string()
  .trim()
  .max(20000, "Must not exceed 20000 characters.")
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value));
export const UploadOptionalTextSchema = z
  .string()
  .trim()
  .min(1, "Must not be empty.")
  .max(200, "Must not exceed 200 characters.")
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value));
export const UploadUuidSchema = z.uuid();

// -------------------------------------------------------------
// Upload request create / list / lifecycle
// -------------------------------------------------------------
export const CreateUploadRequestInputSchema = z
  .object({
    title: UploadTextSchema,
    instructions: z.string().trim().max(20000, "Must not exceed 20000 characters.").default(""),
    expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
    maxItems: z.coerce.number().int().min(1).max(50).default(20),
    targetAssetId: UploadIdSchema.optional().nullable(),
    targetRevisionId: UploadIdSchema.optional().nullable(),
  })
  .strict();
export type CreateUploadRequestInput = z.infer<typeof CreateUploadRequestInputSchema>;

export const UploadRequestStatusFilterSchema = z.enum(["OPEN", "SUBMITTED", "REVOKED", "EXPIRED"]);

export const ListUploadRequestsQuerySchema = z
  .object({
    status: UploadRequestStatusFilterSchema.optional(),
    targetAssetId: UploadIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type ListUploadRequestsQuery = z.infer<typeof ListUploadRequestsQuerySchema>;

export const GetUploadRequestInputSchema = z.object({ id: UploadIdSchema }).strict();

export const RevokeUploadRequestInputSchema = z.object({ id: UploadIdSchema }).strict();

export const RegenerateUploadRequestInputSchema = z.object({ id: UploadIdSchema }).strict();

// -------------------------------------------------------------
// File reservation (server-side metadata only)
// -------------------------------------------------------------
export const ReserveUploadFileInputSchema = z
  .object({
    clientItemId: UploadUuidSchema,
    sourceFilename: z
      .string()
      .refine((value) => sanitizeUploadFilename(value) !== null, {
        message: "Must be a usable filename without directories or control characters.",
      }),
    declaredMimeType: z.string().refine((value) => isAllowedMimeType(value), {
      message: "Declared MIME type is not an allowed format.",
    }),
    expectedByteSize: z.coerce.number().int().min(1, "Must be at least 1 byte."),
  })
  .strict()
  .refine(
    (input) => input.expectedByteSize <= maxBytesForMimeType(input.declaredMimeType),
    { message: "File exceeds the maximum byte size for its format." },
  );
export type ReserveUploadFileInput = z.infer<typeof ReserveUploadFileInputSchema>;

// -------------------------------------------------------------
// Finalization (section 6, "Finalization input and hashing")
// -------------------------------------------------------------
const FinalizeItemCommonSchema = z.object({
  clientItemId: UploadUuidSchema,
  name: UploadTextSchema,
  kind: UploadTextSchema,
  notes: UploadNotesSchema,
  label: UploadOptionalTextSchema,
  variant: UploadOptionalTextSchema,
  format: UploadOptionalTextSchema,
});

// FILE items reject every technical metadata field: they are derived
// server-side from verification and never accepted from the browser.
const FinalizeFileItemSchema = FinalizeItemCommonSchema.extend({
  type: z.literal("FILE"),
  fileId: UploadIdSchema,
}).strict();

const FinalizeExternalUrlItemSchema = FinalizeItemCommonSchema.extend({
  type: z.literal("EXTERNAL_URL"),
  externalUrl: z
    .string()
    .trim()
    .max(2048, "URL must not exceed 2048 characters.")
    .refine((value) => isExternalHttpUrl(value), {
      message: "Must be a public http(s) URL without credentials and without a local destination.",
    }),
}).strict();

export const FinalizeItemSchema = z.discriminatedUnion("type", [
  FinalizeFileItemSchema,
  FinalizeExternalUrlItemSchema,
]);
export type FinalizeItemInput = z.infer<typeof FinalizeItemSchema>;

export const FinalizeUploadInputSchema = z
  .object({
    submissionKey: UploadUuidSchema,
    // Absolute schema cap 50; the request's own maxItems is revalidated in
    // the finalization transaction.
    items: z.array(FinalizeItemSchema).min(1, "At least one item is required.").max(50),
  })
  .strict()
  .refine((input) => {
    const ids = new Set<string>();
    for (const item of input.items) {
      if (ids.has(item.clientItemId)) {
        return false;
      }
      ids.add(item.clientItemId);
    }
    return true;
  }, { message: "Duplicate clientItemId across items." })
  .refine((input) => {
    const fileIds = new Set<string>();
    for (const item of input.items) {
      if (item.type === "FILE") {
        if (fileIds.has(item.fileId)) {
          return false;
        }
        fileIds.add(item.fileId);
      }
    }
    return true;
  }, { message: "Duplicate fileId across items." });
export type FinalizeUploadInput = z.infer<typeof FinalizeUploadInputSchema>;
