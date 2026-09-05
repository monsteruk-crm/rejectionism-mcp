"use server";

import { revalidatePath } from "next/cache";
import {
  createWorkItem,
  updateWorkItem,
  createCanonEntry,
  updateCanonEntry,
  recordDecision,
  createAsset,
  updateAsset,
  updateWebsite,
  createContact,
  updateContact,
  createContentItem,
  updateContentItem,
} from "@/lib/campaign";

// Helper to convert FormData to a plain object
function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (value !== "" && value !== null && value !== undefined) {
      obj[key] = value;
    }
  });
  return obj;
}

// -------------------------------------------------------------
// Work Items
// -------------------------------------------------------------
export async function createWorkItemAction(formData: FormData): Promise<void> {
  const raw = formDataToObject(formData);
  const res = await createWorkItem(raw, "admin");

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/work-items");
}

export async function updateWorkItemAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes: Record<string, unknown> = {};
  const allowedFields = [
    "title",
    "description",
    "status",
    "priority",
    "dueDate",
    "blockedReason",
    "evidenceUrl",
    "completionNote",
  ];

  for (const field of allowedFields) {
    if (formData.has(field)) {
      const val = formData.get(field);
      changes[field] = val === "" ? null : val;
    }
  }

  const res = await updateWorkItem(
    {
      id,
      expectedVersion,
      changes,
    },
    "admin",
  );

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/work-items");
  revalidatePath(`/admin/work-items/${id}`);
}

// -------------------------------------------------------------
// Canon
// -------------------------------------------------------------
export async function createCanonEntryAction(formData: FormData): Promise<void> {
  const raw = formDataToObject(formData);
  const res = await createCanonEntry(raw, "admin");

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/canon");
}

export async function updateCanonEntryAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes: Record<string, unknown> = {};
  if (formData.has("value")) changes.value = formData.get("value");
  if (formData.has("category")) changes.category = formData.get("category");
  if (formData.has("notes")) {
    const val = formData.get("notes");
    changes.notes = val === "" ? null : val;
  }

  const res = await updateCanonEntry(
    {
      id,
      expectedVersion,
      changes,
    },
    "admin",
  );

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/canon");
  revalidatePath(`/admin/canon/${id}`);
}

// -------------------------------------------------------------
// Decisions
// -------------------------------------------------------------
export async function recordDecisionAction(formData: FormData): Promise<void> {
  const subject = formData.get("subject") as string;
  const decision = formData.get("decision") as string;
  const rationale = formData.get("rationale") as string;
  const supersedesId = (formData.get("supersedesId") as string) || undefined;

  const inputPayload: Record<string, unknown> = {
    subject,
    decision,
    rationale,
    supersedesId,
  };

  const updateCanonMode = formData.get("updateCanonMode") as string;
  if (updateCanonMode === "create") {
    inputPayload.updateCanon = {
      mode: "create",
      key: formData.get("canonKey"),
      value: formData.get("canonValue"),
      category: formData.get("canonCategory"),
      notes: formData.get("canonNotes") || undefined,
    };
  } else if (updateCanonMode === "update") {
    inputPayload.updateCanon = {
      mode: "update",
      key: formData.get("canonKey"),
      value: formData.get("canonValue"),
      expectedVersion: Number(formData.get("canonExpectedVersion")),
      category: formData.get("canonCategory") || undefined,
      notes: formData.get("canonNotes") || undefined,
    };
  }

  const res = await recordDecision(inputPayload, "admin");

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/decisions");
  revalidatePath("/admin/canon");
}

// -------------------------------------------------------------
// Assets
// -------------------------------------------------------------
export async function createAssetAction(formData: FormData): Promise<void> {
  const raw = formDataToObject(formData);
  const res = await createAsset(raw, "admin");

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/assets");
}

export async function updateAssetAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes: Record<string, unknown> = {};
  const allowedFields = ["name", "kind", "status", "sourceFilename", "url", "notes"];

  for (const field of allowedFields) {
    if (formData.has(field)) {
      const val = formData.get(field);
      changes[field] = val === "" ? null : val;
    }
  }

  const res = await updateAsset(
    {
      id,
      expectedVersion,
      changes,
    },
    "admin",
  );

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${id}`);
}

// -------------------------------------------------------------
// Websites
// -------------------------------------------------------------
export async function updateWebsiteAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes: Record<string, unknown> = {};
  const allowedFields = [
    "name",
    "purpose",
    "status",
    "repositoryUrl",
    "deploymentUrl",
    "notes",
  ];

  for (const field of allowedFields) {
    if (formData.has(field)) {
      const val = formData.get(field);
      changes[field] = val === "" ? null : val;
    }
  }

  const res = await updateWebsite(
    {
      id,
      expectedVersion,
      changes,
    },
    "admin",
  );

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/websites");
  revalidatePath(`/admin/websites/${id}`);
}

// -------------------------------------------------------------
// Contacts
// -------------------------------------------------------------
export async function createContactAction(formData: FormData): Promise<void> {
  const raw = formDataToObject(formData);
  const res = await createContact(raw, "admin");

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/contacts");
}

export async function updateContactAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes: Record<string, unknown> = {};
  const allowedFields = ["name", "organization", "role", "email", "status", "notes"];

  for (const field of allowedFields) {
    if (formData.has(field)) {
      const val = formData.get(field);
      changes[field] = val === "" ? null : val;
    }
  }

  const res = await updateContact(
    {
      id,
      expectedVersion,
      changes,
    },
    "admin",
  );

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/contacts");
  revalidatePath(`/admin/contacts/${id}`);
}

// -------------------------------------------------------------
// Content Items
// -------------------------------------------------------------
export async function createContentItemAction(formData: FormData): Promise<void> {
  const raw = formDataToObject(formData);
  const res = await createContentItem(raw, "admin");

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/content");
}

export async function updateContentItemAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const expectedVersion = Number(formData.get("expectedVersion"));

  const changes: Record<string, unknown> = {};
  const allowedFields = [
    "title",
    "format",
    "channel",
    "status",
    "scheduledFor",
    "publishedUrl",
    "notes",
  ];

  for (const field of allowedFields) {
    if (formData.has(field)) {
      const val = formData.get(field);
      changes[field] = val === "" ? null : val;
    }
  }

  const res = await updateContentItem(
    {
      id,
      expectedVersion,
      changes,
    },
    "admin",
  );

  if (!res.ok) {
    throw new Error(`[${res.error.code}] ${res.error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${id}`);
}
