import { getPublicUploadRequest } from "@/lib/campaign/upload-requests";
import { UploadForm } from "../_components/upload-form";
import {
  MAX_FILE_BYTES,
  MAX_SVG_BYTES,
  MAX_SUBMISSION_BYTES,
  AllowedMimeType,
} from "@/lib/campaign/file-validation";
import { PublicUploadRequestDto } from "@/lib/uploads/client-contract";

/**
 * Public capability upload page (/upload/[token])
 * (upgrade plan section 5, "Public upload and API boundaries"; section 6).
 *
 * - Capability authorization only: no admin password or session required.
 * - Server renders a safe request projection (title, instructions, expiry,
 *   maxItems, targeting mode label, allowed formats/sizes) without internal IDs.
 * - Terminal states for expired/revoked/submitted links show explicit status
 *   messages without exposing upload controls.
 */

const ALLOWED_MIME_TYPES: AllowedMimeType[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/zip",
];

export default async function UploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicUploadRequest(token);

  if (!result.ok) {
    return (
      <div className="bg-paper border border-ink/10 rounded-sm p-8 text-center space-y-4 shadow-sm">
        <span className="inline-block text-3xl text-rejection-red font-bold">&times;</span>
        <h1 className="text-xl font-bold font-serif">Upload Link Unavailable</h1>
        <p className="text-sm text-ink/70">
          This upload link was not found or is no longer valid. Please request a new submission link from your campaign coordinator.
        </p>
      </div>
    );
  }

  const req = result.data;

  if (req.status === "REVOKED") {
    return (
      <div className="bg-paper border border-ink/10 rounded-sm p-8 text-center space-y-4 shadow-sm">
        <span className="inline-block text-3xl text-rejection-red font-bold">&times;</span>
        <h1 className="text-xl font-bold font-serif">Upload Link Revoked</h1>
        <p className="text-sm text-ink/70">
          This submission link has been revoked by the campaign administrator.
        </p>
      </div>
    );
  }

  if (req.status === "EXPIRED") {
    return (
      <div className="bg-paper border border-ink/10 rounded-sm p-8 text-center space-y-4 shadow-sm">
        <span className="inline-block text-3xl text-amber-700 font-bold">&#9888;</span>
        <h1 className="text-xl font-bold font-serif">Upload Link Expired</h1>
        <p className="text-sm text-ink/70">
          This submission link expired on {new Date(req.expiresAt).toLocaleString()}.
        </p>
      </div>
    );
  }

  const requestDto: PublicUploadRequestDto = {
    title: req.title,
    instructions: req.instructions,
    expiresAt: req.expiresAt,
    maxItems: req.maxItems,
    targetingMode: req.targetingMode,
    status: req.status,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxFileBytes: MAX_FILE_BYTES,
    maxSvgBytes: MAX_SVG_BYTES,
    maxSubmissionBytes: MAX_SUBMISSION_BYTES,
    submissionReceipt: req.submissionReceipt,
  };

  return <UploadForm uploadToken={token} request={requestDto} />;
}
