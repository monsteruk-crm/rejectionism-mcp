"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  rememberMemory,
  updateMemory,
  supersedeMemory,
  archiveMemory,
  getMemory,
  type MemoryDto,
} from "@/lib/campaign/memories";
import {
  type RememberMemoryInput,
  type UpdateMemoryInput,
  type SupersedeMemoryInput,
  type ArchiveMemoryInput,
  type MemoryCategory,
} from "@/lib/campaign/memory-schemas";
import type { ActionResult } from "@/lib/admin/action-result";
import { requireAdminAction } from "@/lib/auth/boundaries";

/**
 * Server Actions for /admin/memory (ADR 0007, execution plan section 9). All
 * actions begin with `requireAdminAction()` before parsing inputs. Controlled
 * React draft state in the form component preserves user input on validation
 * failure. Optimistic concurrency uses the real server version, never a
 * server-calculated old+1 guess.
 */

export interface CreateMemoryActionInput {
  title: string;
  content: string;
  category: string;
  key: string;
  importance: number;
  confidence: number;
  pinned: boolean;
  sourceLabel: string;
  sourceUrl: string;
  expiresAt: string;
  tagsCsv: string;
}

function parseIntInput(raw: unknown, fallback: number): number {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCheckInput(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return false;
  return raw === "on" || raw === "true" || raw === "1";
}

function parseCsvTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function categoryOrDefault(raw: string | null): MemoryCategory {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return "OTHER";
  return trimmed as MemoryCategory;
}

export async function createMemoryAction(
  formData: FormData,
): Promise<ActionResult<{ memory: MemoryDto }>> {
  await requireAdminAction();

  const input: RememberMemoryInput = {
    title: (formData.get("title") as string | null)?.trim() ?? "",
    content: (formData.get("content") as string | null)?.trim() ?? "",
    category: categoryOrDefault(formData.get("category") as string | null),
    key:
      (formData.get("key") as string | null)?.trim() && (formData.get("key") as string)?.trim() !== ""
        ? (formData.get("key") as string).trim()
        : undefined,
    importance: parseIntInput(formData.get("importance"), 50),
    confidence: parseIntInput(formData.get("confidence"), 100),
    pinned: parseCheckInput(formData.get("pinned")),
    sourceLabel:
      (formData.get("sourceLabel") as string | null)?.trim() || null,
    sourceUrl:
      (formData.get("sourceUrl") as string | null)?.trim() || null,
    expiresAt:
      (formData.get("expiresAt") as string | null)?.trim() || null,
    tags: parseCsvTags(formData.get("tagsCsv") as string | null),
    relationships: [],
  };

  const res = await rememberMemory(input, "admin");
  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      code: res.error.code,
    };
  }

  revalidatePath("/admin/memory");
  revalidatePath(`/admin/memory/${res.data.memory.id}`);
  redirect(`/admin/memory/${res.data.memory.id}?created=1&outcome=${res.data.outcome}`);
}

export async function updateMemoryAction(
  formData: FormData,
): Promise<ActionResult<{ memory: MemoryDto; changed: boolean }>> {
  await requireAdminAction();

  const input: UpdateMemoryInput = {
    id: (formData.get("id") as string | null)?.trim() ?? "",
    expectedVersion: parseIntInput(formData.get("expectedVersion"), 0),
    changes: {
      title: (formData.get("title") as string | null)?.trim() || undefined,
      content: (formData.get("content") as string | null)?.trim() || undefined,
      category: ((formData.get("category") as string | null)?.trim() || undefined) as
        | RememberMemoryInput["category"]
        | undefined,
      importance: formData.has("importance")
        ? parseIntInput(formData.get("importance"), 50)
        : undefined,
      confidence: formData.has("confidence")
        ? parseIntInput(formData.get("confidence"), 100)
        : undefined,
      pinned: formData.has("pinned") ? parseCheckInput(formData.get("pinned")) : undefined,
      sourceLabel:
        (formData.get("sourceLabel") as string | null) === null
          ? undefined
          : ((formData.get("sourceLabel") as string).trim() === "" ? null : ((formData.get("sourceLabel") as string).trim())),
      sourceUrl:
        (formData.get("sourceUrl") as string | null) === null
          ? undefined
          : ((formData.get("sourceUrl") as string).trim() === "" ? null : ((formData.get("sourceUrl") as string).trim())),
      expiresAt:
        (formData.get("expiresAt") as string | null) === null
          ? undefined
          : ((formData.get("expiresAt") as string).trim() === "" ? null : ((formData.get("expiresAt") as string).trim())),
    },
  };

  const res = await updateMemory(input, "admin");
  if (!res.ok) {
    return { ok: false, error: res.error.message, code: res.error.code };
  }

  revalidatePath("/admin/memory");
  revalidatePath(`/admin/memory/${res.data.memory.id}`);
  return { ok: true, data: res.data };
}

export async function supersedeMemoryAction(
  formData: FormData,
): Promise<ActionResult<{ memory: MemoryDto; supersededMemory: MemoryDto }>> {
  await requireAdminAction();

  const input: SupersedeMemoryInput = {
    supersedesId: (formData.get("supersedesId") as string | null)?.trim() ?? "",
    expectedVersion: parseIntInput(formData.get("expectedVersion"), 0),
    copyConnections: parseCheckInput(formData.get("copyConnections")),
    newMemory: {
      title: (formData.get("title") as string | null)?.trim() ?? "",
      content: (formData.get("content") as string | null)?.trim() ?? "",
      category: categoryOrDefault(formData.get("category") as string | null),
      key:
        (formData.get("key") as string | null)?.trim() && (formData.get("key") as string)?.trim() !== ""
          ? (formData.get("key") as string).trim()
          : null,
      importance: parseIntInput(formData.get("importance"), 50),
      confidence: parseIntInput(formData.get("confidence"), 100),
      pinned: parseCheckInput(formData.get("pinned")),
      sourceLabel:
        (formData.get("sourceLabel") as string | null)?.trim() || null,
      sourceUrl:
        (formData.get("sourceUrl") as string | null)?.trim() || null,
      expiresAt:
        (formData.get("expiresAt") as string | null)?.trim() || null,
      tags: parseCsvTags(formData.get("tagsCsv") as string | null),
      relationships: [],
    },
  };

  const res = await supersedeMemory(input, "admin");
  if (!res.ok) {
    return { ok: false, error: res.error.message, code: res.error.code };
  }

  revalidatePath("/admin/memory");
  revalidatePath(`/admin/memory/${res.data.memory.id}`);
  revalidatePath(`/admin/memory/${res.data.supersededMemory.id}`);
  redirect(`/admin/memory/${res.data.memory.id}?outcome=SUPERSEDED`);
}

export async function archiveMemoryAction(
  formData: FormData,
): Promise<ActionResult<{ memory: MemoryDto; changed: boolean }>> {
  await requireAdminAction();

  const input: ArchiveMemoryInput = {
    id: (formData.get("id") as string | null)?.trim() ?? "",
    expectedVersion: parseIntInput(formData.get("expectedVersion"), 0),
  };
  const res = await archiveMemory(input, "admin");
  if (!res.ok) {
    return { ok: false, error: res.error.message, code: res.error.code };
  }

  revalidatePath("/admin/memory");
  revalidatePath(`/admin/memory/${res.data.memory.id}`);
  redirect(`/admin/memory/${res.data.memory.id}?outcome=ARCHIVED`);
}

export async function getMemoryForEditAction(
  rawInput: unknown,
): Promise<ActionResult<{ memory: MemoryDto }>> {
  await requireAdminAction();
  const id =
    typeof rawInput === "object" && rawInput !== null && "id" in rawInput
      ? String((rawInput as Record<string, unknown>).id ?? "")
      : "";
  const res = await getMemory({ id, trackAccess: false });
  if (!res.ok) {
    return { ok: false, error: res.error.message, code: res.error.code };
  }
  return { ok: true, data: { memory: res.data.memory } };
}

export async function noop(): Promise<ActionResult<Record<string, never>>> {
  return { ok: true, data: {} };
}
