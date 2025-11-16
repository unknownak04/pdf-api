const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json({ limit: "50mb" }));

// 🚨 Insert your Nanonets API key here:
const NANONETS_API_KEY = "cb5c4dd4-c2bf-11f0-98c9-1edd0239ff34";

app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;

    if (!pdfUrl || !page) {
      return res.status(400).json({ error: "Missing pdfUrl or page" });
    }

    // 1. Download PDF (as binary)
    const pdfResponse = await axios.get(pdfUrl, {
      responseType: "arraybuffer",
      timeout: 60000
    });

    const pdfBase64 = Buffer.from(pdfResponse.data).toString("base64");

    // 2. Send to Nanonets OCR
    const nanoRes = await axios.post(
      "https://app.nanonets.com/api/v2/OCR/Model/GeneralOCR/LabelFiles/",
      {
        file: pdfBase64
      },
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${NANONETS_API_KEY}:`).toString("base64"),
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    // 3. Extract OCR text blocks
    if (!nanoRes.data?.results?.length) {
      return res.status(500).json({ error: "No OCR results returned" });
    }

    const blocks = nanoRes.data.results[0].text_blocks || [];

    // 4. Group text blocks by PAGE number (bbox-based grouping)
    const pages = {};

    blocks.forEach((b) => {
      const pg = b.page || 1;
      if (!pages[pg]) pages[pg] = [];
      pages[pg].push(b.text);
    });

    // 5. Select the requested page
    const pageText = pages[page];

    if (!pageText) {
      return res.status(404).json({ error: "Requested page not found" });
    }

    // 6. Return only that page text
    return res.json({
      success: true,
      page: page,
      text: pageText.join(" "),
    });

  } catch (err) {
    console.error("OCR Error:", err);
    return res.status(500).json({
      error: err.message || "Unknown server/OCR error",
    });
  }
});

// Basic home route
app.get("/", (req, res) => {
  res.send("PDF OCR API running.");
});

app.listen(10000, () => {
  console.log("Server running on port 10000");
});
