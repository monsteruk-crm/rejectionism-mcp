"use client";

export function ConflictReview({
  currentVersion,
  onUseDraftAgainstVersion,
  onDiscardDraft,
}: {
  currentVersion: number;
  onUseDraftAgainstVersion?: (version: number) => void;
  onDiscardDraft?: () => void;
}) {
  return (
    <div className="mt-4 border-2 border-blood-red bg-paper p-4">
      <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-rejection-red">
        Version Conflict Detected
      </h4>
      <p className="mt-1 text-xs text-ink/90">
        Another editor or agent updated this record concurrently. Your draft has been preserved.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {onUseDraftAgainstVersion && (
          <button
            type="button"
            onClick={() => onUseDraftAgainstVersion(currentVersion)}
            className="cursor-pointer bg-rejection-red px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-paper hover:bg-ink"
          >
            Use my draft against version {currentVersion}
          </button>
        )}
        {onDiscardDraft && (
          <button
            type="button"
            onClick={onDiscardDraft}
            className="cursor-pointer border border-ink/40 bg-paper px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-ink hover:bg-cream"
          >
            Discard draft & load latest
          </button>
        )}
      </div>
    </div>
  );
}
