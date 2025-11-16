import express from "express";
import axios from "axios";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import "pdfjs-dist/legacy/build/pdf.worker.js";
import { createCanvas } from "canvas";

const app = express();
app.use(express.json({ limit: "50mb" }));

// --- helper: clean & format extracted text
function cleanExtractedText(rawText) {
  if (!rawText) return "";

  let t = rawText;

  // normalize whitespace
  t = t.replace(/\r\n/g, "\n");
  t = t.replace(/\t/g, " ");
  t = t.replace(/ {2,}/g, " ");

  // split likely table rows where long runs of spaces or repeating pattern indicate new row
  // add newline before sequences like "4113.010.001" or 6+ digit codes
  t = t.replace(/(\d{3,}\.\d{3}\.\d{3}|\b\d{6,}\b)/g, "\n$1");

  // better split on multiple spaces used as column separators
  t = t.replace(/ {3,}/g, "\t");

  // put each "Code D A L" style header on its own line with tabs
  t = t.replace(/\b(Code)\s+(D)\s+(A)\s+(L)\b/gi, "Code\tD\tA\tL");

  // ensure headings (ALLCAP words) become separate lines
  t = t.replace(/\n?([A-Z][A-Z ]{2,}[A-Z])\n?/g, "\n$1\n");

  // trim and remove duplicate empty lines
  t = t.replace(/\n{3,}/g, "\n\n").trim();

  return t;
}

// --- helper: render a PDF page to PNG (base64)
async function renderPageToPngBase64(pdf, pageNumber, scale = 2) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");

  await page.render({ canvasContext: ctx, viewport }).promise;

  const pngBuffer = canvas.toBuffer("image/png");
  return "data:image/png;base64," + pngBuffer.toString("base64");
}

// --- main endpoint
app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;
    if (!pdfUrl || page == null) {
      return res.status(400).json({ success: false, error: "Missing pdfUrl or page" });
    }

    // 1) download PDF (arraybuffer)
    const dl = await axios.get(pdfUrl, { responseType: "arraybuffer", timeout: 60000 });
    const pdfData = new Uint8Array(dl.data);

    // 2) load pdfjs document
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

    if (page < 1 || page > pdf.numPages) {
      return res.status(400).json({ success: false, error: `Invalid page. PDF has ${pdf.numPages} pages.` });
    }

    // 3) extract raw text
    const pdfPage = await pdf.getPage(page);
    const textContent = await pdfPage.getTextContent();
    const rawText = (textContent.items || []).map(i => i.str).join(" ").trim();

    // 4) format text
    const formattedText = cleanExtractedText(rawText);

    // 5) render PNG of page
    let imageData = null;
    try {
      imageData = await renderPageToPngBase64(pdf, page, 2); // scale 2 for good resolution
    } catch (err) {
      console.warn("Page render failed:", err.message || err);
      imageData = null;
    }

    // 6) if text empty and you want OCR fallback, you can handle that here (not included)
    if (!formattedText || formattedText.length === 0) {
      // return empty text but include image (useful for manual OCR or display)
      return res.json({ success: true, text: formattedText, image: imageData });
    }

    return res.json({ success: true, text: formattedText, image: imageData });
  } catch (err) {
    console.error("Extract error:", err);
    return res.json({ success: false, error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`PDF API running on port ${PORT}`));
