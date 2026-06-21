"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, cx } from "./ui";

// Signature pad supporting Draw / Type (cursive) / use saved signature.
// Emits a PNG data URL via onChange.

type Mode = "draw" | "type" | "saved";

export function SignaturePad({
  saved,
  onChange,
  allowSaved = true,
}: {
  saved?: string | null;
  onChange: (dataUrl: string | null) => void;
  allowSaved?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(saved && allowSaved ? "saved" : "draw");
  const [typed, setTyped] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  // ---- Draw mode ----
  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      drawing.current = true;
      hasInk.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => {
      if (!drawing.current) return;
      drawing.current = false;
      emitDraw();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function emitDraw() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk.current) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clearDraw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange(null);
  }

  // ---- Type mode: render cursive text to a canvas ----
  function emitTyped(text: string) {
    setTyped(text);
    if (!text.trim()) {
      onChange(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1e293b";
    ctx.font = "64px 'Brush Script MT', 'Segoe Script', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 20, 80);
    onChange(canvas.toDataURL("image/png"));
  }

  function chooseSaved() {
    if (saved) onChange(saved);
  }

  return (
    <div>
      <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-lg w-fit">
        {allowSaved && saved && (
          <TabBtn active={mode === "saved"} onClick={() => { setMode("saved"); chooseSaved(); }}>
            Saved
          </TabBtn>
        )}
        <TabBtn active={mode === "draw"} onClick={() => { setMode("draw"); onChange(null); }}>
          Draw
        </TabBtn>
        <TabBtn active={mode === "type"} onClick={() => { setMode("type"); emitTyped(typed); }}>
          Type
        </TabBtn>
      </div>

      {mode === "saved" && (
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center justify-center h-40">
          {saved ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={saved} alt="Saved signature" className="max-h-32" />
          ) : (
            <span className="text-sm text-slate-400">No saved signature</span>
          )}
        </div>
      )}

      {mode === "draw" && (
        <div>
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="w-full h-40 border border-slate-300 rounded-lg bg-white touch-none cursor-crosshair"
          />
          <div className="mt-2">
            <Button type="button" size="sm" variant="ghost" onClick={clearDraw}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {mode === "type" && (
        <div>
          <Input
            placeholder="Type your name"
            value={typed}
            onChange={(e) => emitTyped(e.target.value)}
          />
          {typed && (
            <div
              className="mt-2 border border-slate-200 rounded-lg p-3 bg-white text-4xl text-slate-800 h-24 flex items-center"
              style={{ fontFamily: "'Brush Script MT','Segoe Script',cursive" }}
            >
              {typed}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
        active ? "bg-white shadow-sm text-slate-800" : "text-slate-500"
      )}
    >
      {children}
    </button>
  );
}
