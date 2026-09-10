"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/boundaries";
import {
  createAdminUploadSession,
  cancelAdminUploadSession,
  listAdminUploadSessions,
  AdminUploadSessionDto,
} from "@/lib/campaign/admin-upload-sessions";
import { ActionResult, actionSuccess, actionFailure } from "@/lib/admin/action-result";

export async function createAdminUploadSessionAction(
  _prevState: ActionResult<AdminUploadSessionDto> | null,
  formData: FormData,
): Promise<ActionResult<AdminUploadSessionDto>> {
  await requireAdminAction();
  const targetAssetId = (formData.get("targetAssetId") as string)?.trim() || null;
  const targetRevisionId = (formData.get("targetRevisionId") as string)?.trim() || null;

  const res = await createAdminUploadSession(
    {
      targetAssetId,
      targetRevisionId,
    },
    "admin",
  );

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin/assets/upload");
  return actionSuccess(res.data, "Internal upload session initialized.");
}

export async function cancelAdminUploadSessionAction(
  _prevState: ActionResult<{ id: string; status: "REVOKED" }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; status: "REVOKED" }>> {
  await requireAdminAction();
  const id = (formData.get("id") as string)?.trim();
  if (!id) {
    return actionFailure("Session ID is required.", "VALIDATION_ERROR");
  }

  const res = await cancelAdminUploadSession(id, "admin");
  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code);
  }

  revalidatePath("/admin/assets/upload");
  return actionSuccess(res.data, "Upload session canceled.");
}
