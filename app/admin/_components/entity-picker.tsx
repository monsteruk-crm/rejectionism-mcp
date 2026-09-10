"use client";

import { useState, useEffect } from "react";
import { lookupEntitiesAction, lookupAssetRevisionsAction } from "../lookup-actions";
import type { EntityLookupItem, AssetRevisionLookupItem } from "@/lib/campaign/admin-lookups";
import type { OriginalEntityType } from "@/lib/campaign/tag-schemas";

export interface EntityPickerProps {
  label: string;
  entityTypes?: OriginalEntityType[];
  excludeEntityId?: string;
  excludeEntityType?: OriginalEntityType;
  onSelect: (item: EntityLookupItem | null) => void;
  selectedItem?: EntityLookupItem | null;
  allowRevisionSelection?: boolean;
  onSelectRevision?: (revision: AssetRevisionLookupItem | null) => void;
  selectedRevision?: AssetRevisionLookupItem | null;
}

export function EntityPicker({
  label,
  entityTypes,
  excludeEntityId,
  excludeEntityType,
  onSelect,
  selectedItem,
  allowRevisionSelection = false,
  onSelectRevision,
  selectedRevision,
}: EntityPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityLookupItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Revisions state
  const [revisions, setRevisions] = useState<AssetRevisionLookupItem[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  const fetchEntities = async (pageOffset = 0) => {
    setLoading(true);
    const res = await lookupEntitiesAction({
      query,
      entityTypes,
      limit: 20,
      offset: pageOffset,
    });
    setLoading(false);
    setHasSearched(true);
    if (res.ok) {
      let filtered = res.data.items;
      if (excludeEntityId && excludeEntityType) {
        filtered = filtered.filter(
          (item) => !(item.id === excludeEntityId && item.entityType === excludeEntityType),
        );
      }
      setResults(filtered);
      setTotal(res.data.total);
      setOffset(pageOffset);
    }
  };

  useEffect(() => {
    if (allowRevisionSelection && selectedItem && selectedItem.entityType === "ASSET" && onSelectRevision) {
      setRevisionsLoading(true);
      lookupAssetRevisionsAction({ assetId: selectedItem.id, limit: 20 }).then((res) => {
        setRevisionsLoading(false);
        if (res.ok) {
          setRevisions(res.data.items);
        }
      });
    } else {
      setRevisions([]);
    }
  }, [selectedItem, allowRevisionSelection, onSelectRevision]);

  return (
    <div className="space-y-3 rounded border-2 border-ink bg-paper p-4 text-xs font-sans">
      <div className="flex items-center justify-between border-b border-ink/20 pb-2">
        <label className="font-heading font-bold uppercase text-ink">{label}</label>
        {selectedItem && (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              if (onSelectRevision) onSelectRevision(null);
            }}
            className="cursor-pointer font-heading text-[11px] font-bold uppercase text-rejection-red hover:underline"
          >
            ✕ Clear Selection
          </button>
        )}
      </div>

      {/* Selected Summary */}
      {selectedItem ? (
        <div className="border border-ink bg-cream p-3">
          <p className="font-heading text-sm font-bold text-ink">{selectedItem.title}</p>
          <p className="font-mono text-[11px] text-ink/70">
            Type: {selectedItem.entityType} // ID: {selectedItem.id}{" "}
            {selectedItem.version !== undefined ? `// v${selectedItem.version}` : ""}
          </p>

          {/* Revisions list if applicable */}
          {allowRevisionSelection && selectedItem.entityType === "ASSET" && onSelectRevision && (
            <div className="mt-3 border-t border-ink/20 pt-2">
              <p className="font-heading text-xs font-bold uppercase text-ink">
                Select Revision (Optional):
              </p>
              {revisionsLoading ? (
                <p className="text-xs italic text-ink/60">Loading revisions...</p>
              ) : revisions.length === 0 ? (
                <p className="text-xs italic text-ink/60">No revisions found.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="revisionRadio"
                      checked={!selectedRevision}
                      onChange={() => onSelectRevision(null)}
                    />
                    <span>None (Target whole asset / new revision)</span>
                  </label>
                  {revisions.map((rev) => (
                    <label key={rev.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="revisionRadio"
                        checked={selectedRevision?.id === rev.id}
                        onChange={() => onSelectRevision(rev)}
                      />
                      <span className="font-mono">
                        Rev #{rev.revisionNumber}{" "}
                        {rev.label ? `— ${rev.label}` : ""}{" "}
                        ({rev.representationCount} file(s))
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  fetchEntities(0);
                }
              }}
              placeholder="Type keyword or leave blank to browse..."
              className="flex-1 border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <button
              type="button"
              onClick={() => fetchEntities(0)}
              disabled={loading}
              className="cursor-pointer border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-cream hover:bg-rejection-red disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {hasSearched && (
            <div className="border border-ink/40 bg-cream p-2">
              {results.length === 0 ? (
                <p className="py-2 text-center text-xs italic text-ink/70">
                  No records found matching query.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="font-heading text-[10px] uppercase text-ink/70">
                    Results ({total} found):
                  </p>
                  <ul className="max-h-48 divide-y divide-ink/15 overflow-y-auto">
                    {results.map((item) => (
                      <li key={`${item.entityType}-${item.id}`} className="py-1.5">
                        <label className="flex cursor-pointer items-start gap-2 hover:text-rejection-red">
                          <input
                            type="radio"
                            name="entityPickerRadio"
                            checked={false}
                            onChange={() => onSelect(item)}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-bold text-ink">{item.title}</span>
                            <span className="ml-2 font-mono text-[10px] text-ink/60">
                              [{item.entityType}] #{item.id.slice(-8)}
                            </span>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>

                  {/* Bounded pagination controls */}
                  {total > 20 && (
                    <div className="flex items-center justify-between border-t border-ink/20 pt-2 font-heading text-[11px]">
                      <button
                        type="button"
                        disabled={offset === 0 || loading}
                        onClick={() => fetchEntities(Math.max(0, offset - 20))}
                        className="cursor-pointer border border-ink bg-paper px-2 py-1 font-bold uppercase hover:bg-ink hover:text-cream disabled:opacity-30"
                      >
                        &larr; Prev
                      </button>
                      <span className="text-ink/70">
                        {offset + 1}–{Math.min(total, offset + 20)} of {total}
                      </span>
                      <button
                        type="button"
                        disabled={offset + 20 >= total || loading}
                        onClick={() => fetchEntities(offset + 20)}
                        className="cursor-pointer border border-ink bg-paper px-2 py-1 font-bold uppercase hover:bg-ink hover:text-cream disabled:opacity-30"
                      >
                        Next &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
