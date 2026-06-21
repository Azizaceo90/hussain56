import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Server-side PDF stamping with pdf-lib. Field coordinates are normalized
// (0..1) with a TOP-LEFT origin (matching how the browser places them over the
// rendered page). pdf-lib uses a BOTTOM-LEFT origin, so we convert per page.

export type Stamp =
  | {
      kind: "text";
      page: number;
      x: number;
      y: number;
      w: number;
      h: number;
      value: string;
    }
  | {
      kind: "image";
      page: number;
      x: number;
      y: number;
      w: number;
      h: number;
      dataUrl: string; // PNG data URL
    };

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export async function stampPdf(
  pdfDataUrl: string,
  stamps: Stamp[]
): Promise<string> {
  const pdf = await PDFDocument.load(dataUrlToBytes(pdfDataUrl));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const s of stamps) {
    const page = pages[s.page] ?? pages[0];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();

    // Box in PDF points (bottom-left origin).
    const boxX = s.x * W;
    const boxW = s.w * W;
    const boxH = s.h * H;
    const boxBottom = (1 - (s.y + s.h)) * H;

    if (s.kind === "image") {
      try {
        const png = await pdf.embedPng(dataUrlToBytes(s.dataUrl));
        // Fit image within the box, preserving aspect ratio.
        const scale = Math.min(boxW / png.width, boxH / png.height);
        const drawW = png.width * scale;
        const drawH = png.height * scale;
        page.drawImage(png, {
          x: boxX + (boxW - drawW) / 2,
          y: boxBottom + (boxH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      } catch (e) {
        console.error("[pdf] failed to embed signature image", e);
      }
    } else {
      const text = s.value ?? "";
      // Size text to roughly fill the box height, capped for sanity.
      let fontSize = Math.min(Math.max(boxH * 0.6, 8), 16);
      // Shrink if it overflows width.
      let textWidth = font.widthOfTextAtSize(text, fontSize);
      while (textWidth > boxW && fontSize > 6) {
        fontSize -= 0.5;
        textWidth = font.widthOfTextAtSize(text, fontSize);
      }
      page.drawText(text, {
        x: boxX + 2,
        y: boxBottom + (boxH - fontSize) / 2 + 1,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.25),
      });
    }
  }

  const bytes = await pdf.save();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:application/pdf;base64,${base64}`;
}
