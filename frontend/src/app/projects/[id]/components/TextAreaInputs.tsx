import apiClient from "@/lib/apiClient";
import { debounce } from "lodash";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NoteEditor } from "./NoteEditor";

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
      // Add a buffer to prevent cutting off the bottom border or scrollbar
      const buffer = 40;
      const reservedSpaceForNote1 = note2Height + gapBetweenNotes + totalToolbarHeight + fixedOffset + buffer;
      const reservedSpaceForNote2 = 240 + gapBetweenNotes + totalToolbarHeight + fixedOffset + buffer;

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
      // Flush pending saves on unmount to ensure notes are saved
      debouncedSaveNote1.flush();
      debouncedSaveNote2.flush();
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

  return (
    <div ref={containerRef} className="flex flex-col gap-6 w-full mx-auto p-4">
      <NoteEditor
        id="note1"
        label="Notes 1"
        value={note1}
        onChange={handleNote1Change}
        onWheel={handleWheel}
        isSaving={isSavingNote1}
        maxHeight={dynamicMaxHeightNote1}
        editorRef={note1Ref}
      />
      <NoteEditor
        id="note2"
        label="Notes 2"
        value={note2}
        onChange={handleNote2Change}
        onWheel={handleWheel}
        isSaving={isSavingNote2}
        maxHeight={dynamicMaxHeightNote2}
        editorRef={note2Ref}
      />
    </div>
  );
});

TextAreaInputs.displayName = "TextAreaInputs";
