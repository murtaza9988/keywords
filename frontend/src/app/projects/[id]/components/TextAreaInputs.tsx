import apiClient from "@/lib/apiClient";
import { debounce } from "lodash";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

export const TextAreaInputs = memo(({ projectId }: { projectId: string }) => {
  const [note1, setNote1] = useState("");
  const [note2, setNote2] = useState("");
  const [isSavingNote1, setIsSavingNote1] = useState(false);
  const [isSavingNote2, setIsSavingNote2] = useState(false);
  const [authToken, setAuthToken] = useState<string>("");
  const note1Ref = useRef<HTMLDivElement>(null);
  const note2Ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dynamicMaxHeightNote1, setDynamicMaxHeightNote1] = useState(400);
  const [dynamicMaxHeightNote2, setDynamicMaxHeightNote2] = useState(400);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    setAuthToken(token);
  }, []);

  const calculateMaxHeight = useCallback(() => {
    if (containerRef.current && note1Ref.current && note2Ref.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const fixedOffset = 120;
      const gapBetweenNotes = 24;
      const toolbarHeight = 40;
      const totalToolbarHeight = toolbarHeight * 2;
      const note2Height = Math.max(
        note2Ref.current.scrollHeight,
        note2Ref.current.clientHeight,
        150 
      );

      const availableHeight = viewportHeight - containerRect.top;
      const reservedSpaceForNote1 = note2Height + gapBetweenNotes + totalToolbarHeight + fixedOffset;
      const reservedSpaceForNote2 = 240 + gapBetweenNotes + totalToolbarHeight + fixedOffset;
      const maxHeightNote1 = Math.max(300, availableHeight - reservedSpaceForNote1);
      const maxHeightNote2 = Math.max(300, availableHeight - reservedSpaceForNote2);

      setDynamicMaxHeightNote1(Math.floor(maxHeightNote1));
      setDynamicMaxHeightNote2(Math.floor(maxHeightNote2));
    }
  }, []);

  useEffect(() => {
    calculateMaxHeight();

    const handleResize = () => {
      calculateMaxHeight();
    };
    const resizeObserver = new ResizeObserver(() => {
      calculateMaxHeight();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [calculateMaxHeight]);

  const adjustHeight = useCallback((element: HTMLDivElement, maxHeight: number) => {
    element.style.height = "auto";
    const newHeight = Math.max(150, Math.min(maxHeight, element.scrollHeight));
    element.style.height = `${newHeight}px`;
  }, []);

  const debouncedSaveNote1 = useMemo(
    () =>
      debounce(async (note: string) => {
        try {
          setIsSavingNote1(true);
          await apiClient.saveNotes(projectId, note, note2);
        } catch (error) {
          console.error("Error saving note 1:", error);
        } finally {
          setIsSavingNote1(false);
        }
      }, 1000),
    [projectId, note2]
  );

  const debouncedSaveNote2 = useMemo(
    () =>
      debounce(async (note: string) => {
        try {
          setIsSavingNote2(true);
          await apiClient.saveNotes(projectId, note1, note);
        } catch (error) {
          console.error("Error saving note 2:", error);
        } finally {
          setIsSavingNote2(false);
        }
      }, 1000),
    [projectId, note1]
  );

  useEffect(() => {
    return () => {
      debouncedSaveNote1.cancel();
      debouncedSaveNote2.cancel();
    };
  }, [debouncedSaveNote1, debouncedSaveNote2]);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const notesData = await apiClient.fetchNotes(projectId);
        setNote1(notesData.note1 || "");
        setNote2(notesData.note2 || "");
        if (note1Ref.current) {
          note1Ref.current.innerHTML = notesData.note1 || "";
          setTimeout(() => adjustHeight(note1Ref.current!, dynamicMaxHeightNote1), 0);
        }
        if (note2Ref.current) {
          note2Ref.current.innerHTML = notesData.note2 || "";
          setTimeout(() => adjustHeight(note2Ref.current!, dynamicMaxHeightNote2), 0);
        }
      } catch (error) {
        console.error("Error fetching notes:", error);
      }
    };

    if (projectId && authToken) {
      fetchNotes();
    }
  }, [projectId, authToken, adjustHeight, dynamicMaxHeightNote1, dynamicMaxHeightNote2]);

  const handleNote1Change = useCallback(() => {
    if (note1Ref.current) {
      const value = note1Ref.current.innerHTML;
      setNote1(value);
      adjustHeight(note1Ref.current, dynamicMaxHeightNote1);
      calculateMaxHeight();
      debouncedSaveNote1(value);
    }
  }, [adjustHeight, calculateMaxHeight, debouncedSaveNote1, dynamicMaxHeightNote1]);

  const handleNote2Change = useCallback(() => {
    if (note2Ref.current) {
      const value = note2Ref.current.innerHTML;
      setNote2(value);
      adjustHeight(note2Ref.current, dynamicMaxHeightNote2);
      calculateMaxHeight();
      debouncedSaveNote2(value);
    }
  }, [adjustHeight, calculateMaxHeight, debouncedSaveNote2, dynamicMaxHeightNote2]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isScrollable = element.scrollHeight > element.clientHeight;

    if (isScrollable) {
      e.stopPropagation();
      element.scrollTop += e.deltaY;
    }
  };

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
    if (document.activeElement === note1Ref.current) handleNote1Change();
    else if (document.activeElement === note2Ref.current) handleNote2Change();
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-6 w-full max-w-4xl mx-auto p-4">
      <div className="note-section border border-gray-300 rounded-lg overflow-hidden">
        <div className="header flex items-center gap-1 p-2 bg-gray-100 border-b border-gray-300">
          <label htmlFor="note1" className="text-[13px] font-light mr-2 text-gray-800">
            Notes 1
          </label>
          <div className="toolbar flex gap-2">
            <button
              onClick={() => formatText("bold")}
              className="px-2 py-1 text-[13px] bg-gray-200 rounded hover:bg-gray-300"
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <select
              onChange={(e) => formatText("fontSize", e.target.value)}
              className="text-[13px] bg-gray-200 rounded px-2 py-1"
              title="Font Size"
            >
              <option value="">Font Size</option>
              <option value="12px">12px</option>
              <option value="16px">16px</option>
              <option value="24px">24px</option>
              <option value="32px">32px</option>
            </select>
            <input
              type="color"
              onChange={(e) => formatText("foreColor", e.target.value)}
              className="w-6 h-6 p-0 border-0 cursor-pointer bg-gray-200 rounded"
              title="Text Color"
            />
          </div>
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
            {isSavingNote1 ? (
              <span className="inline-block w-3 h-3 border-2 border-green-400 border-t-green-700 rounded-full animate-spin" />
            ) : (
              <div className="flex items-center">
                <span>Saved</span>
              </div>
            )}
          </span>
        </div>
        <div
          id="note1"
          ref={note1Ref}
          contentEditable
          onInput={handleNote1Change}
          onWheel={handleWheel}
          className="w-full text-gray-700 p-3 resize-y"
          style={{
            whiteSpace: "pre-wrap",
            minHeight: "150px",
            height: "150px",
            maxHeight: `${dynamicMaxHeightNote1}px`,
            overflowY: "auto",
            outline: "none",
            border: "none",
            resize: "vertical",
          }}
        />
      </div>
      <div className="note-section border border-gray-300 rounded-lg overflow-hidden">
        <div className="header flex items-center gap-1 p-2 bg-gray-100 border-b border-gray-300">
          <label htmlFor="note2" className="text-[13px] font-light mr-2 text-gray-800">
            Notes 2
          </label>
          <div className="toolbar flex gap-2">
            <button
              onClick={() => formatText("bold")}
              className="px-2 py-1 text-[13px] bg-gray-200 rounded hover:bg-gray-300"
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <select
              onChange={(e) => formatText("fontSize", e.target.value)}
              className="text-[13px] bg-gray-200 rounded px-2 py-1"
              title="Font Size"
            >
              <option value="">Font Size</option>
              <option value="12px">12px</option>
              <option value="16px">16px</option>
              <option value="24px">24px</option>
              <option value="32px">32px</option>
            </select>
            <input
              type="color"
              onChange={(e) => formatText("foreColor", e.target.value)}
              className="w-6 h-6 p-0 border-0 cursor-pointer bg-gray-200 rounded"
              title="Text Color"
            />
          </div>
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
            {isSavingNote2 ? (
              <span className="inline-block w-3 h-3 border-2 border-green-400 border-t-green-700 rounded-full animate-spin" />
            ) : (
              <div className="flex items-center">
                <span>Saved</span>
              </div>
            )}
          </span>
        </div>
        <div
          id="note2"
          ref={note2Ref}
          contentEditable
          onInput={handleNote2Change}
          onWheel={handleWheel}
          className="w-full text-base text-gray-700 p-3 resize-y"
          style={{
            whiteSpace: "pre-wrap",
            minHeight: "150px",
            height: "150px",
            maxHeight: `${dynamicMaxHeightNote2}px`,
            overflowY: "auto",
            outline: "none",
            border: "none",
            resize: "vertical",
          }}
        />
      </div>
    </div>
  );
});

TextAreaInputs.displayName = "TextAreaInputs";
