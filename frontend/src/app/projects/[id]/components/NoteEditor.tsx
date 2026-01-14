import React, { useRef, memo } from 'react';

interface NoteEditorProps {
  label: string;
  value: string;
  onChange: () => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  isSaving: boolean;
  maxHeight: number;
  id: string;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

export const NoteEditor = memo(({
  label,
  onChange,
  onWheel,
  isSaving,
  maxHeight,
  id,
  editorRef
}: NoteEditorProps) => {

  const formatText = (command: string, value?: string) => {
    if (command === "fontSize" && value) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
          const span = document.createElement("span");
          span.style.fontSize = value;
          range.surroundContents(span);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    } else {
      document.execCommand(command, false, value);
    }
    // Trigger change after formatting
    onChange();
  };

  return (
    <div className="note-section border border-border rounded-lg overflow-hidden bg-surface shadow-sm">
      <div className="header flex items-center gap-2 p-2 bg-surface-muted border-b border-border">
        <label htmlFor={id} className="text-[13px] font-medium mr-2 text-foreground">
          {label}
        </label>
        <div className="toolbar flex gap-2 items-center">
          <button
            onClick={() => formatText("bold")}
            className="px-2.5 py-1 text-[13px] bg-surface border border-border rounded hover:bg-surface-strong text-foreground transition-colors font-bold"
            title="Bold"
          >
            B
          </button>
          <select
            onChange={(e) => formatText("fontSize", e.target.value)}
            className="text-[13px] bg-surface border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            title="Font Size"
          >
            <option value="">Size</option>
            <option value="12px">12px</option>
            <option value="16px">16px</option>
            <option value="24px">24px</option>
            <option value="32px">32px</option>
          </select>
          <div className="relative w-6 h-6 rounded border border-border overflow-hidden cursor-pointer bg-surface hover:border-muted transition-colors">
            <input
              type="color"
              onChange={(e) => formatText("foreColor", e.target.value)}
              className="absolute -top-1 -left-1 w-8 h-8 p-0 border-0 cursor-pointer"
              title="Text Color"
            />
          </div>
        </div>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted">
          {isSaving ? (
            <span className="inline-block w-3 h-3 border-2 border-green-400 border-t-green-700 rounded-full animate-spin" />
          ) : (
            <div className="flex items-center">
              <span>Saved</span>
            </div>
          )}
        </span>
      </div>
      <div
        id={id}
        ref={editorRef}
        contentEditable
        onInput={onChange}
        onWheel={onWheel}
        className="w-full text-foreground p-3 resize-y"
        style={{
          whiteSpace: "pre-wrap",
          minHeight: "150px",
          height: "150px",
          maxHeight: `${maxHeight}px`,
          overflowY: "auto",
          outline: "none",
          border: "none",
          resize: "vertical",
        }}
      />
    </div>
  );
});

NoteEditor.displayName = "NoteEditor";
