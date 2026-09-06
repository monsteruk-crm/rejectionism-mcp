"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/boundaries";
import {
  createUploadRequest,
  revokeUploadRequest,
  regenerateUploadRequest,
} from "@/lib/campaign";
import type { ActionResult } from "../_components/form-feedback";

function stringOrNull(val: FormDataEntryValue | null): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length === 0 ? null : s;
}

export async function createUploadRequestAction(
  _prevState: ActionResult<{ id: string; uploadUrl: string; expiresAt: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; uploadUrl: string; expiresAt: string }>> {
  await requireAdminAction();

  const title = String(formData.get("title") || "").trim();
  const instructions = String(formData.get("instructions") || "").trim();
  const expiresInDaysRaw = formData.get("expiresInDays");
  const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : 7;
  const maxItemsRaw = formData.get("maxItems");
  const maxItems = maxItemsRaw ? Number(maxItemsRaw) : 20;

  const targetAssetId = stringOrNull(formData.get("targetAssetId"));
  const targetRevisionId = stringOrNull(formData.get("targetRevisionId"));

  const res = await createUploadRequest(
    {
      title,
      instructions,
      expiresInDays,
      maxItems,
      targetAssetId: targetAssetId || undefined,
      targetRevisionId: targetRevisionId || undefined,
    },
    "admin",
  );

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      code: res.error.code,
      fieldErrors: res.error.fieldErrors,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/upload-links");
  if (targetAssetId) {
    revalidatePath(`/admin/assets/${targetAssetId}`);
  }

  return {
    ok: true,
    data: res.data,
    message: "Upload link created successfully.",
  };
}

export async function revokeUploadRequestAction(
  _prevState: ActionResult<{ id: string; status: "REVOKED" | "SUBMITTED" }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; status: "REVOKED" | "SUBMITTED" }>> {
  await requireAdminAction();

  const id = String(formData.get("id") || "").trim();

  const res = await revokeUploadRequest({ id }, "admin");

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      code: res.error.code,
      fieldErrors: res.error.fieldErrors,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/upload-links");
  revalidatePath(`/admin/upload-links/${id}`);

  return {
    ok: true,
    data: res.data,
    message: "Upload link revoked successfully.",
  };
}

export async function regenerateUploadRequestAction(
  _prevState: ActionResult<{ id: string; replacedId: string; uploadUrl: string; expiresAt: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; replacedId: string; uploadUrl: string; expiresAt: string }>> {
  await requireAdminAction();

  const id = String(formData.get("id") || "").trim();
  const expiresInDaysRaw = formData.get("expiresInDays");
  const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : 7;

  const res = await regenerateUploadRequest(
    {
      id,
      expiresInDays,
    },
    "admin",
  );

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      code: res.error.code,
      fieldErrors: res.error.fieldErrors,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/upload-links");
  revalidatePath(`/admin/upload-links/${id}`);
  revalidatePath(`/admin/upload-links/${res.data.id}`);

  return {
    ok: true,
    data: res.data,
    message: "Upload link regenerated successfully.",
  };
}
