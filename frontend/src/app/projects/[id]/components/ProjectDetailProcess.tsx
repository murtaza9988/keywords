"use client";

import React from 'react';

export function ProjectDetailProcess(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Keyword + token clustering process</h3>
          <p className="text-xs text-muted">
            This is the exact path the backend uses to normalize tokens, group keywords, and select
            parent keywords during CSV processing.
          </p>
        </div>
        <ol className="mt-3 space-y-3 text-xs text-foreground">
          <li className="flex gap-2">
            <span className="font-semibold text-muted">1.</span>
            <div>
              The CSV is saved (chunked uploads are combined first), and processing starts by creating a
              temporary GIN index on tokens for the project so grouping queries stay fast during the run.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-muted">2.</span>
            <div>
              The processor detects encoding/delimiter, validates headers, identifies the keyword, volume,
              difficulty, and SERP feature columns, then counts total rows to drive progress reporting.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-muted">3.</span>
            <div>
              Each row is normalized: numeric strings are cleaned, non-English keywords are flagged as
              blocked, tokens are generated (NLTK), compound variants are normalized, stop words are
              removed, tokens are lemmatized, synonyms are collapsed, and the final unique token list is
              sorted for deterministic grouping.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-muted">4.</span>
            <div>
              Duplicates are skipped if the keyword text already exists in the project or has already been
              seen in the current upload batch.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-muted">5.</span>
            <div>
              Tokens are compared against existing grouped keywords. If an identical token set already
              exists, the keyword is assigned to that existing group immediately.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-muted">6.</span>
            <div>
              Otherwise, keywords are buffered into a token-key map. For each token group, the members are
              sorted by volume (desc) and difficulty (asc). Singletons remain ungrouped parents; multi-key
              groups get a new group id, with the top member becoming the parent and receiving the summed
              volume + averaged difficulty.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-muted">7.</span>
            <div>
              Batched keywords are written to the database, parent stats for existing groups are refreshed,
              and progress is updated until all rows are processed.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-muted">8.</span>
            <div>
              After all rows, a final sweep groups any remaining ungrouped keywords that share identical
              tokens, applying the same parent selection and aggregated volume/difficulty logic.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-muted">9.</span>
            <div>
              The temporary index is removed and the processing status flips to complete, so the parent
              keyword totals reflect the fully clustered state.
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
