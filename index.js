import express from "express";
import axios from "axios";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs"; // Correct Node import

const app = express();
app.use(express.json());

// PDF EXTRACT ENDPOINT
app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;

    if (!pdfUrl || !page) {
      return res.json({ success: false, error: "Missing parameters" });
    }

    // 1. Download PDF as ArrayBuffer
    const response = await axios.get(pdfUrl, {
      responseType: "arraybuffer",
    });

    const pdfData = new Uint8Array(response.data);

    // 2. Load PDF
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

    if (page < 1 || page > pdf.numPages) {
      return res.json({ success: false, error: "Invalid page number" });
    }

    // 3. Extract page
    const pdfPage = await pdf.getPage(page);
    const textContent = await pdfPage.getTextContent();

    const text = textContent.items.map((t) => t.str).join(" ");

    return res.json({
      success: true,
      text,
    });
  } catch (err) {
    console.error("ERROR:", err);
    return res.json({ success: false, error: err.message });
  }
});

// SERVER LISTEN
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
