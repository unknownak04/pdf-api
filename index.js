import express from "express";
import axios from "axios";

const app = express();
app.use(express.json({ limit: "50mb" }));

// 🚨 Your Nanonets API Key
const NANONETS_API_KEY = "cb5c4dd4-c2bf-11f0-98c9-1edd0239ff34";

app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;

    if (!pdfUrl || !page) {
      return res.status(400).json({ error: "Missing pdfUrl or page" });
    }

    // Download PDF
    const pdfResponse = await axios.get(pdfUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const pdfBase64 = Buffer.from(pdfResponse.data).toString("base64");

    // Send to Nanonets OCR
    const nanoRes = await axios.post(
      "https://app.nanonets.com/api/v2/OCR/Model/GeneralOCR/LabelFiles/",
      { file: pdfBase64 },
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${NANONETS_API_KEY}:`).toString("base64"),
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    if (!nanoRes.data?.results?.length) {
      return res.status(500).json({ error: "No OCR results returned" });
    }

    const blocks = nanoRes.data.results[0].text_blocks || [];

    const pages = {};
    blocks.forEach((b) => {
      const pg = b.page || 1;
      if (!pages[pg]) pages[pg] = [];
      pages[pg].push(b.text);
    });

    const pageText = pages[page];
    if (!pageText) {
      return res.status(404).json({ error: "Requested page not found" });
    }

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

// basic home route
app.get("/", (req, res) => {
  res.send("PDF OCR API running (ESM mode).");
});

app.listen(10000, () => {
  console.log("Server running on port 10000");
});
