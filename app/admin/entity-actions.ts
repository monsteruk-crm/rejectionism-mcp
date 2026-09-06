"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/boundaries";
import {
  tagEntity,
  untagEntity,
  linkEntities,
  unlinkEntities,
  entityHref,
  OriginalEntityType,
  EntityRelationType,
} from "@/lib/campaign";
import type { ActionResult } from "./_components/form-feedback";

function stringOrNull(val: FormDataEntryValue | null): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length === 0 ? null : s;
}

export async function tagEntityAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const entityType = String(formData.get("entityType") || "") as OriginalEntityType;
  const entityId = String(formData.get("entityId") || "").trim();
  const tag = String(formData.get("tag") || "").trim();

  const res = await tagEntity(
    {
      entityType,
      entityId,
      tag,
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

  const href = entityHref(entityType, entityId);
  revalidatePath(href);
  revalidatePath("/admin");

  return {
    ok: true,
    data: res.data,
    message: res.data.changed ? `Tag #${res.data.tag.slug} attached.` : `Tag #${res.data.tag.slug} already attached.`,
  };
}

export async function untagEntityAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const entityType = String(formData.get("entityType") || "") as OriginalEntityType;
  const entityId = String(formData.get("entityId") || "").trim();
  const tagSlug = String(formData.get("tagSlug") || "").trim();

  const res = await untagEntity(
    {
      entityType,
      entityId,
      tagSlug,
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

  const href = entityHref(entityType, entityId);
  revalidatePath(href);
  revalidatePath("/admin");

  return {
    ok: true,
    data: res.data,
    message: `Tag #${tagSlug} removed.`,
  };
}

export async function linkEntitiesAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const fromEntityType = String(formData.get("fromEntityType") || "") as OriginalEntityType;
  const fromEntityId = String(formData.get("fromEntityId") || "").trim();
  const toEntityType = String(formData.get("toEntityType") || "") as OriginalEntityType;
  const toEntityId = String(formData.get("toEntityId") || "").trim();
  const relationType = String(formData.get("relationType") || "") as EntityRelationType;
  const notes = stringOrNull(formData.get("notes"));

  const res = await linkEntities(
    {
      from: { entityType: fromEntityType, entityId: fromEntityId },
      to: { entityType: toEntityType, entityId: toEntityId },
      relationType,
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

  const fromHref = entityHref(fromEntityType, fromEntityId);
  const toHref = entityHref(toEntityType, toEntityId);
  revalidatePath(fromHref);
  revalidatePath(toHref);

  return {
    ok: true,
    data: res.data,
    message: res.data.changed ? "Relationship linked successfully." : "Relationship already linked.",
  };
}

export async function unlinkEntitiesAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminAction();

  const relationId = String(formData.get("relationId") || "").trim();
  const revalidateHref = String(formData.get("revalidateHref") || "").trim();

  const res = await unlinkEntities({ relationId }, "admin");

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      code: res.error.code,
      fieldErrors: res.error.fieldErrors,
    };
  }

  if (revalidateHref) {
    revalidatePath(revalidateHref);
  }
  revalidatePath("/admin");

  return {
    ok: true,
    data: res.data,
    message: "Relationship removed.",
  };
}
