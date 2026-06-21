"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ContractField } from "@/lib/types";

// Renders a PDF (data URL) to canvas with pdfjs-dist and overlays placed
// fields. Supports a placement mode where clicking adds a field, and shows a
// page navigator. Coordinates are normalized (0..1) with a top-left origin.

let pdfjsPromise: Promise<any> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export function ContractPdf({
  dataUrl,
  fields,
  placing,
  onPlace,
  onRemoveField,
}: {
  dataUrl: string;
  fields: ContractField[];
  placing?: boolean;
  onPlace?: (page: number, x: number, y: number) => void;
  onRemoveField?: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);
  const docRef = useRef<any>(null);
  const uid = useId();

  // Load document once per dataUrl.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const pdfjs = await getPdfjs();
      const bytes = Uint8Array.from(
        atob(dataUrl.split(",")[1] || ""),
        (c) => c.charCodeAt(0)
      );
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      if (cancelled) return;
      docRef.current = doc;
      setNumPages(doc.numPages);
      setPage(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  // Render the current page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const doc = docRef.current;
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!doc || !canvas || !wrap) return;
      const p = await doc.getPage(page + 1);
      const containerW = wrap.clientWidth || 600;
      const unscaled = p.getViewport({ scale: 1 });
      const scale = containerW / unscaled.width;
      const viewport = p.getViewport({ scale });
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      if (cancelled) return;
      await p.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;
      setSize({ w: viewport.width, h: viewport.height });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, numPages, dataUrl]);

  function handleClick(e: React.MouseEvent) {
    if (!placing || !onPlace) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onPlace(page, x, y);
  }

  const pageFields = fields.filter((f) => f.page === page);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-100"
      >
        {loading && (
          <div className="absolute inset-0 grid place-items-center text-sm text-slate-400 z-10">
            Loading PDF…
          </div>
        )}
        <div
          className="relative"
          style={{ width: size.w || "100%", height: size.h || 400 }}
          onClick={handleClick}
        >
          <canvas ref={canvasRef} className={placing ? "cursor-crosshair" : ""} />
          {pageFields.map((f) => (
            <div
              key={f.id}
              className="absolute border-2 border-dashed rounded flex items-center justify-center text-[10px] font-medium select-none"
              style={{
                left: `${f.x * 100}%`,
                top: `${f.y * 100}%`,
                width: `${f.w * 100}%`,
                height: `${f.h * 100}%`,
                borderColor: f.owner === "issuer" ? "#7c3aed" : "#2563eb",
                background:
                  f.owner === "issuer"
                    ? "rgba(124,58,237,0.12)"
                    : "rgba(37,99,235,0.10)",
                color: f.owner === "issuer" ? "#6d28d9" : "#1d4ed8",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onRemoveField) onRemoveField(f.id);
              }}
              title={onRemoveField ? "Click to remove" : f.type}
            >
              {f.owner === "issuer" ? "✎ my sig" : f.type}
            </div>
          ))}
        </div>
      </div>

      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-2 text-sm">
          <button
            className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹ Prev
          </button>
          <span className="text-slate-500">
            Page {page + 1} of {numPages}
          </span>
          <button
            className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40"
            disabled={page >= numPages - 1}
            onClick={() => setPage((p) => Math.min(numPages - 1, p + 1))}
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
