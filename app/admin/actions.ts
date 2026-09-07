"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/boundaries";
import {
  createWorkItem,
  updateWorkItem,
  createCanonEntry,
  updateCanonEntry,
  recordDecision,
  createAsset,
  updateAsset,
  createWebsite,
  updateWebsite,
  createContact,
  updateContact,
  createContentItem,
  updateContentItem,
} from "@/lib/campaign";
import { ActionResult, actionSuccess, actionFailure } from "@/lib/admin/action-result";
import { extractWhitelistedFormFields } from "@/lib/admin/form-values";

// -------------------------------------------------------------
// Work Items
// -------------------------------------------------------------
export async function createWorkItemAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const raw = extractWhitelistedFormFields(
    formData,
    [
      "id",
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "blockedReason",
      "evidenceUrl",
      "completionNote",
    ],
    {
      emptyStringFields: ["description"],
      nullableFields: ["id", "dueDate", "blockedReason", "evidenceUrl", "completionNote"],
      numberFields: ["priority"],
      isoDateFields: ["dueDate"],
    },
  );

  const res = await createWorkItem(raw as any, "admin");

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/work-items");
  return actionSuccess(res.data, `Work item "${res.data.title}" created successfully.`);
}

export async function updateWorkItemAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const id = (formData.get("id") as string)?.trim();
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes = extractWhitelistedFormFields(
    formData,
    [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "blockedReason",
      "evidenceUrl",
      "completionNote",
    ],
    {
      emptyStringFields: ["description"],
      nullableFields: ["dueDate", "blockedReason", "evidenceUrl", "completionNote"],
      numberFields: ["priority"],
      isoDateFields: ["dueDate"],
    },
  );

  const completionNote = (formData.get("completionNote") as string)?.trim() || null;

  const res = await updateWorkItem(
    {
      id,
      expectedVersion,
      changes: changes as any,
      completionNote: completionNote || undefined,
    },
    "admin",
  );

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/work-items");
  revalidatePath(`/admin/work-items/${id}`);
  return actionSuccess(res.data, `Work item "${res.data.title}" updated successfully.`);
}

// -------------------------------------------------------------
// Canon
// -------------------------------------------------------------
export async function createCanonEntryAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const raw = extractWhitelistedFormFields(
    formData,
    ["id", "key", "value", "category", "notes"],
    {
      nullableFields: ["id", "notes"],
    },
  );

  const res = await createCanonEntry(raw as any, "admin");

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/canon");
  return actionSuccess(res.data, `Canon entry "${res.data.key}" created successfully.`);
}

export async function updateCanonEntryAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const id = (formData.get("id") as string)?.trim();
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes = extractWhitelistedFormFields(
    formData,
    ["value", "category", "notes"],
    {
      nullableFields: ["notes"],
    },
  );

  const res = await updateCanonEntry(
    {
      id,
      expectedVersion,
      changes: changes as any,
    },
    "admin",
  );

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/canon");
  revalidatePath(`/admin/canon/${id}`);
  return actionSuccess(res.data, `Canon entry "${res.data.key}" updated successfully.`);
}

// -------------------------------------------------------------
// Decisions
// -------------------------------------------------------------
export async function recordDecisionAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const subject = (formData.get("subject") as string)?.trim();
  const decision = (formData.get("decision") as string)?.trim();
  const rationale = (formData.get("rationale") as string)?.trim();
  const supersedesId = (formData.get("supersedesId") as string)?.trim() || null;

  const inputPayload: Record<string, unknown> = {
    subject,
    decision,
    rationale,
    supersedesId: supersedesId || undefined,
  };

  const updateCanonMode = formData.get("updateCanonMode") as string;
  if (updateCanonMode === "create") {
    inputPayload.updateCanon = {
      mode: "create",
      key: (formData.get("canonKey") as string)?.trim(),
      value: (formData.get("canonValue") as string)?.trim(),
      category: (formData.get("canonCategory") as string)?.trim(),
      notes: (formData.get("canonNotes") as string)?.trim() || undefined,
    };
  } else if (updateCanonMode === "update") {
    inputPayload.updateCanon = {
      mode: "update",
      key: (formData.get("canonKey") as string)?.trim(),
      value: (formData.get("canonValue") as string)?.trim(),
      expectedVersion: Number(formData.get("canonExpectedVersion")),
      category: (formData.get("canonCategory") as string)?.trim() || undefined,
      notes: (formData.get("canonNotes") as string)?.trim() || undefined,
    };
  }

  const res = await recordDecision(inputPayload as any, "admin");

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/decisions");
  revalidatePath("/admin/canon");
  return actionSuccess(res.data, `Decision "${res.data.subject}" recorded successfully.`);
}

// -------------------------------------------------------------
// Assets
// -------------------------------------------------------------
export async function createAssetAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const raw = extractWhitelistedFormFields(
    formData,
    ["id", "name", "kind", "status", "sourceFilename", "url", "notes"],
    {
      nullableFields: ["id", "sourceFilename", "url", "notes"],
    },
  );

  const res = await createAsset(raw as any, "admin");

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/assets");
  return actionSuccess(res.data, `Asset "${res.data.name}" created successfully.`);
}

export async function updateAssetAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const id = (formData.get("id") as string)?.trim();
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes = extractWhitelistedFormFields(
    formData,
    ["name", "kind", "status", "sourceFilename", "url", "notes"],
    {
      nullableFields: ["sourceFilename", "url", "notes"],
    },
  );

  const res = await updateAsset(
    {
      id,
      expectedVersion,
      changes: changes as any,
    },
    "admin",
  );

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${id}`);
  return actionSuccess(res.data, `Asset "${res.data.name}" updated successfully.`);
}

// -------------------------------------------------------------
// Websites
// -------------------------------------------------------------
export async function createWebsiteAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const raw = extractWhitelistedFormFields(
    formData,
    ["id", "name", "domain", "purpose", "status", "repositoryUrl", "deploymentUrl", "notes"],
    {
      nullableFields: ["id", "repositoryUrl", "deploymentUrl", "notes"],
    },
  );

  const res = await createWebsite(raw as any, "admin");

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/websites");
  return actionSuccess(res.data, `Website "${res.data.name}" created successfully.`);
}

export async function updateWebsiteAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const id = (formData.get("id") as string)?.trim();
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes = extractWhitelistedFormFields(
    formData,
    ["name", "purpose", "status", "repositoryUrl", "deploymentUrl", "notes"],
    {
      nullableFields: ["repositoryUrl", "deploymentUrl", "notes"],
    },
  );

  const res = await updateWebsite(
    {
      id,
      expectedVersion,
      changes: changes as any,
    },
    "admin",
  );

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/websites");
  revalidatePath(`/admin/websites/${id}`);
  return actionSuccess(res.data, `Website "${res.data.name}" updated successfully.`);
}

// -------------------------------------------------------------
// Contacts
// -------------------------------------------------------------
export async function createContactAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const raw = extractWhitelistedFormFields(
    formData,
    ["id", "name", "organization", "role", "email", "status", "notes"],
    {
      nullableFields: ["id", "organization", "role", "email", "notes"],
    },
  );

  const res = await createContact(raw as any, "admin");

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/contacts");
  return actionSuccess(res.data, `Contact "${res.data.name}" created successfully.`);
}

export async function updateContactAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const id = (formData.get("id") as string)?.trim();
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes = extractWhitelistedFormFields(
    formData,
    ["name", "organization", "role", "email", "status", "notes"],
    {
      nullableFields: ["organization", "role", "email", "notes"],
    },
  );

  const res = await updateContact(
    {
      id,
      expectedVersion,
      changes: changes as any,
    },
    "admin",
  );

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/contacts");
  revalidatePath(`/admin/contacts/${id}`);
  return actionSuccess(res.data, `Contact "${res.data.name}" updated successfully.`);
}

// -------------------------------------------------------------
// Content Items
// -------------------------------------------------------------
export async function createContentItemAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const raw = extractWhitelistedFormFields(
    formData,
    ["id", "title", "format", "channel", "status", "scheduledFor", "publishedUrl", "notes"],
    {
      nullableFields: ["id", "scheduledFor", "publishedUrl", "notes"],
      isoDateFields: ["scheduledFor"],
    },
  );

  const res = await createContentItem(raw as any, "admin");

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/content");
  return actionSuccess(res.data, `Content item "${res.data.title}" created successfully.`);
}

export async function updateContentItemAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();
  const id = (formData.get("id") as string)?.trim();
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes = extractWhitelistedFormFields(
    formData,
    ["title", "format", "channel", "status", "scheduledFor", "publishedUrl", "notes"],
    {
      nullableFields: ["scheduledFor", "publishedUrl", "notes"],
      isoDateFields: ["scheduledFor"],
    },
  );

  const res = await updateContentItem(
    {
      id,
      expectedVersion,
      changes: changes as any,
    },
    "admin",
  );

  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code, res.error.fieldErrors);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${id}`);
  return actionSuccess(res.data, `Content item "${res.data.title}" updated successfully.`);
}
