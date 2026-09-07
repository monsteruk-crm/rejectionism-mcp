"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  tagEntityAction,
  untagEntityAction,
  linkEntitiesAction,
  unlinkEntitiesAction,
} from "../entity-actions";
import { FormFeedback } from "./form-feedback";
import { EntityPicker } from "./entity-picker";
import type { EntityLookupItem } from "@/lib/campaign/admin-lookups";
import type { TagDto, OriginalEntityType, EntityRelationType } from "@/lib/campaign";

export interface EntityConnectionsProps {
  entityType: OriginalEntityType;
  entityId: string;
  tags: TagDto[];
  relationships: Array<{
    id: string;
    relationType: string;
    notes: string | null;
    createdAt: string;
    fromTitle?: string;
    toTitle?: string;
    fromHref?: string;
    toHref?: string;
    from: { entityType: string; entityId: string };
    to: { entityType: string; entityId: string };
    direction?: "incoming" | "outgoing";
  }>;
  currentHref: string;
}

const ALL_ENTITY_TYPES: Array<{ label: string; value: OriginalEntityType }> = [
  { label: "Work Item", value: "WORK_ITEM" },
  { label: "Canon Entry", value: "CANON_ENTRY" },
  { label: "Decision", value: "DECISION" },
  { label: "Visual Asset", value: "ASSET" },
  { label: "Website", value: "WEBSITE" },
  { label: "Content Item", value: "CONTENT_ITEM" },
  { label: "Contact", value: "CONTACT" },
];

const RELATION_TYPES: Array<{ label: string; value: EntityRelationType; description: string }> = [
  { label: "Relates To", value: "RELATES_TO", description: "General bilateral association" },
  { label: "Uses Asset", value: "USES_ASSET", description: "Entity uses visual asset (target must be Asset)" },
  { label: "Part Of", value: "PART_OF", description: "Entity belongs to another parent entity" },
];

export function EntityConnections({
  entityType,
  entityId,
  tags,
  relationships,
  currentHref,
}: EntityConnectionsProps) {
  // Tagging state
  const [tagState, tagAction, isTagPending] = useActionState(tagEntityAction, null);
  const [untagState, untagAction] = useActionState(untagEntityAction, null);

  // Linking state
  const [linkState, linkAction, isLinkPending] = useActionState(linkEntitiesAction, null);
  const [unlinkState, unlinkAction] = useActionState(unlinkEntitiesAction, null);

  // Link Form Modal/Accordion
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [relationType, setRelationType] = useState<EntityRelationType>("RELATES_TO");
  const [targetType, setTargetType] = useState<OriginalEntityType>("WORK_ITEM");
  const [selectedTarget, setSelectedTarget] = useState<EntityLookupItem | null>(null);

  const handleRelationTypeChange = (newType: EntityRelationType) => {
    setRelationType(newType);
    if (newType === "USES_ASSET") {
      setTargetType("ASSET");
      if (selectedTarget && selectedTarget.entityType !== "ASSET") {
        setSelectedTarget(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------- */}
      {/* TAGS SECTION */}
      {/* -------------------------------------------------------- */}
      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="flex items-center justify-between border-b-2 border-ink pb-3">
          <h3 className="font-heading text-lg font-black uppercase text-ink">
            Tags ({tags.length})
          </h3>
          <span className="font-mono text-xs text-ink/60">Polymorphic Set</span>
        </div>

        <div className="mt-4 space-y-3">
          <FormFeedback state={tagState} />
          <FormFeedback state={untagState} />

          {tags.length === 0 ? (
            <p className="text-xs italic text-ink/60">No tags attached to this record.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-1.5 border-2 border-ink bg-cream px-2.5 py-1 font-mono text-xs text-ink"
                >
                  <Link
                    href={`/admin/search?q=${encodeURIComponent(t.slug)}`}
                    className="hover:text-rejection-red hover:underline"
                  >
                    #{t.slug}
                  </Link>
                  <form action={untagAction} className="inline">
                    <input type="hidden" name="entityType" value={entityType} />
                    <input type="hidden" name="entityId" value={entityId} />
                    <input type="hidden" name="tagSlug" value={t.slug} />
                    <button
                      type="submit"
                      title="Remove tag"
                      className="ml-1 text-ink/40 hover:text-blood-red font-bold"
                    >
                      &times;
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {/* Add Tag Form */}
          <form action={tagAction} className="mt-4 flex flex-wrap items-center gap-2 pt-2">
            <input type="hidden" name="entityType" value={entityType} />
            <input type="hidden" name="entityId" value={entityId} />
            <input
              type="text"
              name="tag"
              required
              maxLength={80}
              placeholder="Add tag (e.g. launch, logo, priority-1)..."
              className="w-64 border-2 border-ink bg-cream p-1.5 font-sans text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <button
              type="submit"
              disabled={isTagPending}
              className="border border-ink bg-ink px-3 py-1.5 font-heading text-xs font-bold uppercase text-cream hover:bg-rejection-red disabled:opacity-50"
            >
              {isTagPending ? "Attaching..." : "+ Attach Tag"}
            </button>
          </form>
        </div>
      </div>

      {/* -------------------------------------------------------- */}
      {/* RELATIONSHIPS SECTION */}
      {/* -------------------------------------------------------- */}
      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="flex items-center justify-between border-b-2 border-ink pb-3">
          <div>
            <h3 className="font-heading text-lg font-black uppercase text-ink">
              Relationships ({relationships.length})
            </h3>
            <p className="font-sans text-xs text-ink/70">
              Directed links connecting work items, canon, decisions, assets, websites, content, and contacts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsLinkOpen(!isLinkOpen)}
            className="border border-ink bg-cream px-3 py-1 font-heading text-xs font-bold uppercase hover:bg-ink hover:text-cream"
          >
            {isLinkOpen ? "Cancel Link" : "+ Link Entity"}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <FormFeedback state={linkState} />
          <FormFeedback state={unlinkState} />

          {/* Add Relationship Form */}
          {isLinkOpen && (
            <div className="rounded border-2 border-ink bg-cream p-4 space-y-3 font-sans text-xs">
              <p className="font-heading font-black uppercase text-ink">
                Create Directed Relationship
              </p>

              <form action={linkAction} className="space-y-3">
                <input type="hidden" name="fromEntityType" value={entityType} />
                <input type="hidden" name="fromEntityId" value={entityId} />
                <input type="hidden" name="toEntityType" value={selectedTarget ? selectedTarget.entityType : targetType} />
                <input type="hidden" name="toEntityId" value={selectedTarget ? selectedTarget.id : ""} />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="rel_type" className="block font-heading font-bold uppercase text-ink">
                      Relationship Type *
                    </label>
                    <select
                      id="rel_type"
                      name="relationType"
                      value={relationType}
                      onChange={(e) => handleRelationTypeChange(e.target.value as EntityRelationType)}
                      className="mt-1 w-full border-2 border-ink bg-paper p-2 font-heading uppercase text-xs text-ink focus:outline-none"
                    >
                      {RELATION_TYPES.map((rt) => (
                        <option key={rt.value} value={rt.value}>
                          {rt.label} ({rt.value})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="to_entity_type" className="block font-heading font-bold uppercase text-ink">
                      Target Entity Type *
                    </label>
                    <select
                      id="to_entity_type"
                      disabled={relationType === "USES_ASSET"}
                      value={relationType === "USES_ASSET" ? "ASSET" : targetType}
                      onChange={(e) => {
                        const newType = e.target.value as OriginalEntityType;
                        setTargetType(newType);
                        if (selectedTarget && selectedTarget.entityType !== newType) {
                          setSelectedTarget(null);
                        }
                      }}
                      className="mt-1 w-full border-2 border-ink bg-paper p-2 font-heading uppercase text-xs text-ink focus:outline-none disabled:opacity-50"
                    >
                      {ALL_ENTITY_TYPES.map((et) => (
                        <option key={et.value} value={et.value}>
                          {et.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <EntityPicker
                  label="Search & Select Target Record *"
                  entityTypes={relationType === "USES_ASSET" ? ["ASSET"] : [targetType]}
                  excludeEntityId={entityId}
                  excludeEntityType={entityType}
                  selectedItem={selectedTarget}
                  onSelect={(item) => setSelectedTarget(item)}
                />

                <div>
                  <label htmlFor="rel_notes" className="block font-heading font-bold uppercase text-ink">
                    Notes (Immutable)
                  </label>
                  <input
                    type="text"
                    id="rel_notes"
                    name="notes"
                    maxLength={20000}
                    placeholder="Reason or context for this link"
                    className="mt-1 w-full border-2 border-ink bg-paper p-2 text-xs text-ink focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLinkPending || !selectedTarget}
                  className="border-2 border-ink bg-ink px-4 py-2 font-heading font-bold uppercase text-cream hover:bg-rejection-red disabled:opacity-50"
                >
                  {isLinkPending ? "Linking..." : "Confirm Relationship"}
                </button>
              </form>
            </div>
          )}

          {/* Relationships List */}
          {relationships.length === 0 ? (
            <p className="text-xs italic text-ink/60">No relationships established.</p>
          ) : (
            <div className="divide-y divide-ink/15 font-sans text-xs">
              {relationships.map((rel) => {
                const isOutgoing =
                  rel.direction === "outgoing" ||
                  (rel.from.entityType === entityType && rel.from.entityId === entityId);

                const otherTitle = isOutgoing
                  ? rel.toTitle || rel.to.entityId
                  : rel.fromTitle || rel.from.entityId;

                const otherHref = isOutgoing ? rel.toHref : rel.fromHref;
                const otherType = isOutgoing ? rel.to.entityType : rel.from.entityType;

                return (
                  <div key={rel.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="border border-ink/40 bg-cream px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase text-ink">
                          {isOutgoing ? `&rarr; ${rel.relationType}` : `&larr; ${rel.relationType}`}
                        </span>
                        <span className="font-mono text-[10px] text-ink/60">
                          {otherType.replace(/_/g, " ")}:
                        </span>
                        {otherHref ? (
                          <Link href={otherHref} className="font-heading font-bold text-ink underline hover:text-rejection-red">
                            {otherTitle}
                          </Link>
                        ) : (
                          <span className="font-bold text-ink">{otherTitle}</span>
                        )}
                      </div>
                      {rel.notes && (
                        <p className="mt-1 font-sans text-[11px] text-ink/70">
                          {rel.notes}
                        </p>
                      )}
                    </div>

                    <form
                      action={unlinkAction}
                      onSubmit={(e) => {
                        if (!confirm("Are you sure you want to remove this relationship?")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="relationId" value={rel.id} />
                      <input type="hidden" name="revalidateHref" value={currentHref} />
                      <button
                        type="submit"
                        className="text-[11px] font-bold uppercase text-ink/50 hover:text-blood-red"
                      >
                        Unlink &times;
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
