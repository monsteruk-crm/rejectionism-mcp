"use server";

import { requireAdminAction } from "@/lib/auth/boundaries";
import {
  lookupEntities,
  lookupAssetRevisions,
  EntityLookupResult,
  AssetRevisionLookupResult,
} from "@/lib/campaign/admin-lookups";
import { ActionResult, actionSuccess, actionFailure } from "@/lib/admin/action-result";
import type { OriginalEntityType } from "@/lib/campaign/tag-schemas";

export async function lookupEntitiesAction(params: {
  query?: string;
  entityTypes?: OriginalEntityType[];
  limit?: number;
  offset?: number;
}): Promise<ActionResult<EntityLookupResult>> {
  await requireAdminAction();
  const res = await lookupEntities(params);
  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code);
  }
  return actionSuccess(res.data);
}

export async function lookupAssetRevisionsAction(params: {
  assetId: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<AssetRevisionLookupResult>> {
  await requireAdminAction();
  const res = await lookupAssetRevisions(params);
  if (!res.ok) {
    return actionFailure(res.error.message, res.error.code);
  }
  return actionSuccess(res.data);
}
