"use client";

import React from 'react';

export function ProjectDetailProcess(): React.ReactElement {
  const pipelineSteps = [
    {
      title: 'Upload CSV(s)',
      detail: 'Chunked upload (1MB chunks, 2MB when file > 20MB).',
      badge: 'Uploading',
    },
    {
      title: 'Combine chunks',
      detail: 'Server assembles the file, records upload, and de-dupes identical files.',
      badge: 'Combining',
    },
    {
      title: 'Queue processing',
      detail: 'Non-duplicate files enter the DB-backed queue (sequential runner).',
      badge: 'Queued',
    },
    {
      title: 'Import rows',
      detail: 'Validate → normalize → tokenize → dedupe rows.',
      badge: 'Processing',
    },
    {
      title: 'Persist keywords',
      detail: 'Idempotent upsert into the database.',
      badge: 'Processing',
    },
    {
      title: 'Final grouping pass',
      detail: 'Runs once after all queued jobs finish.',
      badge: 'Processing',
    },
    {
      title: 'Complete',
      detail: 'All files processed and grouping finalized.',
      badge: 'Complete',
    },
  ];

  const statusLegend = [
    { label: 'Idle', color: 'bg-gray-400', description: 'Ready for uploads' },
    { label: 'Uploading', color: 'bg-blue-400', description: 'Receiving file chunks' },
    { label: 'Combining', color: 'bg-indigo-400', description: 'Assembling chunks' },
    { label: 'Queued', color: 'bg-yellow-400', description: 'Waiting to process' },
    { label: 'Processing', color: 'bg-orange-400', description: 'Import + persist + group stages' },
    { label: 'Complete', color: 'bg-green-400', description: 'All files processed' },
    { label: 'Error', color: 'bg-red-400', description: 'Processing failed (use Reset)' },
  ];

  const stageLegend = [
    { stage: 'db_prepare', description: 'Prepare DB / temp tables' },
    { stage: 'read_csv', description: 'Read CSV rows' },
    { stage: 'count_rows', description: 'Count rows for progress' },
    { stage: 'import_rows', description: 'Normalize, tokenize, and dedupe rows' },
    { stage: 'persist', description: 'Persist keywords' },
    { stage: 'group', description: 'Final grouping pass' },
    { stage: 'complete', description: 'Processing finished' },
  ];

  const fileLegend = [
    { icon: '✅', label: 'Processed', detail: 'In processedFiles' },
    { icon: '⏳', label: 'Processing', detail: 'Matches currentFileName' },
    { icon: '🕒', label: 'Queued', detail: 'In queuedFiles' },
    { icon: '⚠️', label: 'Error', detail: 'In fileErrors' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Pipeline Overview */}
      <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">🧭 Processing Pipeline (UI-aligned)</h3>
          <p className="text-xs text-muted">
            Matches the progress bar steps, backend stages, and queue behavior shown in the app.
          </p>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pipelineSteps.map((step, index) => (
            <li key={step.title} className="rounded-md border border-border bg-surface-muted px-3 py-3">
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-foreground">{step.title}</span>
                  <span className="text-[11px] text-muted">{step.detail}</span>
                </div>
              </div>
              <span className="mt-2 inline-flex w-fit items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                {step.badge}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          🔒 Grouping is read-only while processing is queued or running. The UI disables controls and the API returns 409 until processing completes.
        </div>
      </div>

      {/* Upload Flow */}
      <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">📤 Upload Flow</h3>
          <p className="text-xs text-muted">
            How CSV files are uploaded and queued for processing.
          </p>
        </div>
        <ol className="mt-3 space-y-2 text-xs text-foreground">
          <li className="flex gap-2">
            <span className="font-semibold text-blue-600">1.</span>
            <div>
              <span className="font-medium">File Upload:</span> CSV files are uploaded in 1MB chunks (2MB for files larger than 20MB) for reliability. Multiple files can be uploaded together as a batch.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-blue-600">2.</span>
            <div>
              <span className="font-medium">Chunk Assembly:</span> When the final chunk arrives, the backend assembles the file, records the upload for download, and de-dupes identical CSV content.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-blue-600">3.</span>
            <div>
              <span className="font-medium">Queue Management:</span> Non-duplicate files are queued for sequential processing, with the progress bar showing the current file and queued files.
            </div>
          </li>
        </ol>
      </div>

      {/* Token Generation */}
      <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">🔤 Token Generation (Normalization)</h3>
          <p className="text-xs text-muted">
            How keywords are converted to tokens for clustering.
          </p>
        </div>
        <ol className="mt-3 space-y-2 text-xs text-foreground">
          <li className="flex gap-2">
            <span className="font-semibold text-green-600">1.</span>
            <div>
              <span className="font-medium">Text Cleanup:</span> Smart quotes, dashes, currency symbols, and numeric formats are normalized (ex: &quot;$1,500&quot; → &quot;1500&quot;).
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-green-600">2.</span>
            <div>
              <span className="font-medium">Tokenization:</span> Keywords are lowercased and split into words using NLTK. Example: &quot;best sba loans&quot; → [&quot;best&quot;, &quot;sba&quot;, &quot;loans&quot;]
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-green-600">3.</span>
            <div>
              <span className="font-medium">Compound Normalization:</span> Open, closed, and hyphenated variants are normalized. Example: &quot;credit-card&quot; and &quot;credit card&quot; both become &quot;creditcard&quot;.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-green-600">4.</span>
            <div>
              <span className="font-medium">Lemmatization:</span> Tokens are cleaned of punctuation/non-English letters and reduced to root forms. Example: &quot;running&quot; → &quot;run&quot;, &quot;loans&quot; → &quot;loan&quot;.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-green-600">5.</span>
            <div>
              <span className="font-medium">Stop Word Removal:</span> Common words (the, a, of, etc.) are removed while question words (what, how, why) are kept.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-green-600">6.</span>
            <div>
              <span className="font-medium">Synonym Mapping & Sorting:</span> WordNet synonyms are collapsed to a base token, then tokens are de-duped and sorted for deterministic matching.
            </div>
          </li>
        </ol>
      </div>

      {/* Auto-Clustering */}
      <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">🔗 Auto-Clustering (Grouping)</h3>
          <p className="text-xs text-muted">
            How keywords with identical tokens are automatically grouped together.
          </p>
        </div>
        <ol className="mt-3 space-y-2 text-xs text-foreground">
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">1.</span>
            <div>
              <span className="font-medium">Post-Import Only:</span> Grouping does not run during import. It runs once after all queued jobs finish.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">2.</span>
            <div>
              <span className="font-medium">Token Matching:</span> Keywords with IDENTICAL token sets are grouped. Example: &quot;sba loans&quot; and &quot;loans sba&quot; both have tokens [&quot;loan&quot;, &quot;sba&quot;] → grouped together.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">3.</span>
            <div>
              <span className="font-medium">Cross-File Clustering:</span> The final pass compares newly imported keywords against existing groups for deterministic results.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">4.</span>
            <div>
              <span className="font-medium">Parent Selection:</span> Within each group, the keyword with highest volume becomes the parent. If volumes are equal, lowest difficulty wins.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">5.</span>
            <div>
              <span className="font-medium">Volume Aggregation:</span> The parent keyword&apos;s volume = sum of all child volumes. This represents total search demand for the topic.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">6.</span>
            <div>
              <span className="font-medium">Difficulty Averaging:</span> The parent keyword&apos;s difficulty = average of all child difficulties. This represents overall competition level.
            </div>
          </li>
        </ol>
      </div>

      {/* Processing States */}
      <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">⚙️ Status & Stage Mapping</h3>
          <p className="text-xs text-muted">
            Status badges shown in the progress bar, plus backend stages used while status is &quot;Processing&quot;.
          </p>
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2 text-xs">
          <div className="rounded-md border border-border bg-surface-muted px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Status badges</div>
            <ul className="mt-2 space-y-2">
              {statusLegend.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  <span>
                    <span className="font-medium">{item.label}:</span> {item.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-border bg-surface-muted px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Processing stages</div>
            <ul className="mt-2 space-y-2">
              {stageLegend.map((item) => (
                <li key={item.stage} className="flex items-center justify-between gap-2">
                  <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                    {item.stage}
                  </span>
                  <span className="text-muted">{item.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Per-File Status */}
      <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">📁 Per-File Status (Uploads)</h3>
          <p className="text-xs text-muted">
            Each uploaded CSV gets its own status in the progress bar summary.
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          {fileLegend.map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-surface-muted px-3 py-3">
              <div className="text-lg">{item.icon}</div>
              <div className="mt-1 text-xs font-semibold text-foreground">{item.label}</div>
              <div className="text-[11px] text-muted">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-amber-800">🔧 Troubleshooting</h3>
        </div>
        <ul className="mt-2 space-y-2 text-xs text-amber-900">
          <li>
            <span className="font-medium">Processing stuck?</span> Click the Reset button in the progress bar to clear the stuck state and try uploading again.
          </li>
          <li>
            <span className="font-medium">Keywords not grouping?</span> Keywords only group when they have IDENTICAL token sets. &quot;sba loan&quot; and &quot;sba loans for business&quot; won&apos;t group because their tokens differ.
          </li>
          <li>
            <span className="font-medium">Missing groups after upload?</span> Use the &quot;Run Grouping&quot; API endpoint to manually trigger the grouping pass.
          </li>
          <li>
            <span className="font-medium">Duplicate keywords?</span> The system automatically skips keywords that already exist in the project (case-insensitive match).
          </li>
          <li>
            <span className="font-medium">Duplicate uploads?</span> If an uploaded CSV matches a previously uploaded file (same name + content), it will be skipped.
          </li>
          <li>
            <span className="font-medium">UI not updating after processing?</span> The UI should auto-refresh when processing completes. If keywords don&apos;t appear, try switching tabs or refreshing the page. Check the Overview tab for the CSV Files progress breakdown.
          </li>
        </ul>
      </div>
    </div>
  );
}
