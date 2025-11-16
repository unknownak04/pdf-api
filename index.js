import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.json({ limit: "50mb" }));

const MODEL_ID = "f01a98b5-ec47-4d1a-8b26-f11a1d5ec318";
const API_KEY = "cb5c4dd4-c2bf-11f0-98c9-1edd0239ff34";

app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;
    if (!pdfUrl || page == null) {
      return res.status(400).json({ success: false, error: "Missing pdfUrl or page parameter" });
    }

    // Download PDF
    const pdfResp = await fetch(pdfUrl);
    if (!pdfResp.ok) {
      throw new Error(`Failed to download PDF: ${pdfResp.status}`);
    }
    const pdfBuffer = await pdfResp.arrayBuffer();

    // Prepare form data
    const form = new FormData();
    form.append("file", Buffer.from(pdfBuffer), {
      filename: "document.pdf",
      contentType: "application/pdf",
    });

    // Send to NanoNets OCR endpoint
    const ocrResp = await fetch(
      `https://app.nanonets.com/api/v2/OCR/Model/${MODEL_ID}/LabelFile/`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(API_KEY + ":").toString("base64"),
          ...form.getHeaders(),
        },
        body: form,
        timeout: 60000,
      }
    );

    const ocrData = await ocrResp.json();
    if (!ocrData.result || !ocrData.result[0] || !ocrData.result[0].page_data) {
      return res.status(500).json({ success: false, error: "Invalid OCR response from NanoNets" });
    }

    // Find requested page text
    const pageData = ocrData.result[0].page_data.find(p => p.page === Number(page));
    if (!pageData) {
      return res.status(404).json({ success: false, error: "Requested page not found in OCR output" });
    }

    return res.json({ success: true, text: pageData.text || "" });

  } catch (err) {
    console.error("Error in /extract:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(10000, () => console.log("Server running on port 10000"));
