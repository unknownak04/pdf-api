import express from "express";
import axios from "axios";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const app = express();
app.use(express.json());

// No worker needed in Node environment
pdfjsLib.GlobalWorkerOptions.workerSrc = null;

app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;

    if (!pdfUrl || !page) {
      return res.json({ success: false, error: "Missing parameters" });
    }

    // Fetch PDF as ArrayBuffer
    const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });

    // Convert ArrayBuffer → Uint8Array
    const pdfData = new Uint8Array(response.data);

    // Load PDF
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

    if (page < 1 || page > pdf.numPages) {
      return res.json({ success: false, error: "Invalid page number" });
    }

    const pdfPage = await pdf.getPage(page);
    const textContent = await pdfPage.getTextContent();

    const items = textContent.items.map(i => i.str);
    const pageText = items.join(" ");

    return res.json({ success: true, text: pageText });

  } catch (error) {
    console.error("Extraction Error:", error);
    return res.json({ success: false, error: error.message });
  }
});

app.listen(10000, () => console.log("PDF API running on port 10000"));
