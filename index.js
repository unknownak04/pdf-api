import express from "express";
import axios from "axios";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs"; // Correct import for Node.js

const app = express();
app.use(express.json());

app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;

    if (!pdfUrl || !page) {
      return res.json({ success: false, error: "Missing parameters" });
    }

    // Fetch PDF as raw ArrayBuffer
    const response = await axios.get(pdfUrl, {
      responseType: "arraybuffer",
    });

    // Convert to Uint8Array for pdfjs
    const pdfData = new Uint8Array(response.data);

    // Load document
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

    if (page < 1 || page > pdf.numPages) {
      return res.json({ success: false, error: "Invalid page number" });
    }

    const pdfPage = await pdf.getPage(page);
    const textContent = await pdfPage.getTextContent();

    const text = textContent.items.map((item) => item.str).join(" ");

    return res.json({ success: true, text });
  } catch
