"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/boundaries";
import {
  createAsset,
  addExternalAsset,
  updateAsset,
  createAssetRevision,
  addAssetRepresentation,
  setPrimaryAssetRepresentation,
} from "@/lib/campaign";
import type { ActionResult } from "../_components/form-feedback";

function stringOrNull(val: FormDataEntryValue | null): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length === 0 ? null : s;
}

export async function createAssetMetadataAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const name = String(formData.get("name") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const status = String(formData.get("status") || "DRAFT").trim();
  const notes = stringOrNull(formData.get("notes"));

  const res = await createAsset(
    {
      name,
      kind,
      status: status || "DRAFT",
      notes,
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
  revalidatePath("/admin/assets");
  return {
    ok: true,
    data: res.data,
    message: `Asset "${res.data.name}" created successfully.`,
  };
}

export async function createExternalAssetAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const name = String(formData.get("name") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const status = String(formData.get("status") || "DRAFT").trim();
  const notes = stringOrNull(formData.get("notes"));

  const externalUrl = String(formData.get("externalUrl") || "").trim();
  const label = stringOrNull(formData.get("label"));
  const variant = stringOrNull(formData.get("variant"));
  const format = stringOrNull(formData.get("format"));
  const sourceFilename = stringOrNull(formData.get("sourceFilename"));
  const repNotes = stringOrNull(formData.get("representationNotes"));

  const res = await addExternalAsset(
    {
      asset: {
        name,
        kind,
        status: (status || "DRAFT") as any,
        notes,
      },
      representation: {
        externalUrl,
        label,
        variant,
        format,
        sourceFilename,
        notes: repNotes,
      },
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
  revalidatePath("/admin/assets");
  return {
    ok: true,
    data: res.data,
    message: `External asset "${res.data.name}" created successfully.`,
  };
}

export async function updateAssetMetadataAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const id = String(formData.get("id") || "").trim();
  const expectedVersion = Number(formData.get("expectedVersion"));
  const name = String(formData.get("name") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const notes = stringOrNull(formData.get("notes"));

  const res = await updateAsset(
    {
      id,
      expectedVersion,
      changes: {
        name,
        kind,
        notes,
      },
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
  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${id}`);
  return {
    ok: true,
    data: res.data,
    message: "Asset metadata updated successfully.",
  };
}

export async function updateAssetWorkflowStatusAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const id = String(formData.get("id") || "").trim();
  const expectedVersion = Number(formData.get("expectedVersion"));
  const status = String(formData.get("status") || "").trim();

  const res = await updateAsset(
    {
      id,
      expectedVersion,
      changes: {
        status: status as any,
      },
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
  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${id}`);
  return {
    ok: true,
    data: res.data,
    message: `Workflow status changed to ${status}.`,
  };
}

export async function createAssetRevisionAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const assetId = String(formData.get("assetId") || "").trim();
  const expectedVersion = Number(formData.get("expectedVersion"));
  const label = stringOrNull(formData.get("label"));
  const notes = stringOrNull(formData.get("notes"));

  const res = await createAssetRevision(
    {
      assetId,
      expectedVersion,
      label,
      notes,
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
  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${assetId}`);
  return {
    ok: true,
    data: res.data,
    message: `Revision ${res.data.revision.revisionNumber} created successfully.`,
  };
}

export async function addAssetRepresentationAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const assetId = String(formData.get("assetId") || "").trim();
  const assetRevisionId = String(formData.get("assetRevisionId") || "").trim();
  const expectedVersion = Number(formData.get("expectedVersion"));
  const externalUrl = String(formData.get("externalUrl") || "").trim();
  const label = stringOrNull(formData.get("label"));
  const variant = stringOrNull(formData.get("variant"));
  const format = stringOrNull(formData.get("format"));
  const sourceFilename = stringOrNull(formData.get("sourceFilename"));
  const notes = stringOrNull(formData.get("notes"));

  const res = await addAssetRepresentation(
    {
      assetRevisionId,
      expectedVersion,
      representation: {
        externalUrl,
        label,
        variant,
        format,
        sourceFilename,
        notes,
      },
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
  revalidatePath("/admin/assets");
  if (assetId) {
    revalidatePath(`/admin/assets/${assetId}`);
  }
  return {
    ok: true,
    data: res.data,
    message: "External representation added successfully.",
  };
}

export async function setPrimaryAssetRepresentationAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const assetId = String(formData.get("assetId") || "").trim();
  const representationId = String(formData.get("representationId") || "").trim();
  const expectedVersion = Number(formData.get("expectedVersion"));

  const res = await setPrimaryAssetRepresentation(
    {
      representationId,
      expectedVersion,
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
  revalidatePath("/admin/assets");
  if (assetId) {
    revalidatePath(`/admin/assets/${assetId}`);
  }
  return {
    ok: true,
    data: res.data,
    message: "Primary representation updated successfully.",
  };
}
