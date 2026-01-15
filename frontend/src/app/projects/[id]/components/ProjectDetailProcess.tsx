"use client";

import React from 'react';

export function ProjectDetailProcess(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      {/* Upload Flow */}
      <div className="rounded-lg border border-border bg-white px-5 py-4 shadow-sm">
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
              <span className="font-medium">Chunk Assembly:</span> When the final chunk arrives, the backend assembles the file, records the upload for download, and skips it if an identical CSV was already uploaded.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-blue-600">3.</span>
            <div>
              <span className="font-medium">Queue Management:</span> Non-duplicate files are queued for sequential processing, with the progress bar showing the current file and any queued files.
            </div>
          </li>
        </ol>
      </div>

      {/* Token Generation */}
      <div className="rounded-lg border border-border bg-white px-5 py-4 shadow-sm">
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
      <div className="rounded-lg border border-border bg-white px-5 py-4 shadow-sm">
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
              <span className="font-medium">Token Matching:</span> Keywords with IDENTICAL token sets are grouped. Example: &quot;sba loans&quot; and &quot;loans sba&quot; both have tokens [&quot;loan&quot;, &quot;sba&quot;] → grouped together.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">2.</span>
            <div>
              <span className="font-medium">Cross-File Clustering:</span> During import, new keywords are checked against existing groups. If tokens match an existing group, the keyword joins that group.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">3.</span>
            <div>
              <span className="font-medium">Parent Selection:</span> Within each group, the keyword with highest volume becomes the parent. If volumes are equal, lowest difficulty wins.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">4.</span>
            <div>
              <span className="font-medium">Volume Aggregation:</span> The parent keyword&apos;s volume = sum of all child volumes. This represents total search demand for the topic.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">5.</span>
            <div>
              <span className="font-medium">Difficulty Averaging:</span> The parent keyword&apos;s difficulty = average of all child difficulties. This represents overall competition level.
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-purple-600">6.</span>
            <div>
              <span className="font-medium">Final Pass:</span> After import, a final grouping pass catches any remaining ungrouped keywords with identical tokens. This ensures no duplicates are missed.
            </div>
          </li>
        </ol>
      </div>

      {/* Processing States */}
      <div className="rounded-lg border border-border bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">⚙️ Processing States</h3>
          <p className="text-xs text-muted">
            The different states during CSV processing.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-400"></span>
            <span><span className="font-medium">Idle:</span> Ready for uploads</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400"></span>
            <span><span className="font-medium">Uploading:</span> Receiving file chunks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
            <span><span className="font-medium">Combining:</span> Assembling chunks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
            <span><span className="font-medium">Queued:</span> Waiting to process</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-400"></span>
            <span><span className="font-medium">Processing:</span> Reading rows, importing batches, and grouping</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400"></span>
            <span><span className="font-medium">Complete:</span> All files processed</span>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <span className="h-2 w-2 rounded-full bg-red-400"></span>
            <span><span className="font-medium">Error:</span> Processing failed (use Reset to recover)</span>
          </div>
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
