import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.json());

const MODEL_ID = "f01a98b5-ec47-4d1a-8b26-f11a1d5ec318";
const API_KEY = "cb5c4dd4-c2bf-11f0-98c9-1edd0239ff34";

app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;

    // 1. Download PDF file from the URL
    const pdfResponse = await fetch(pdfUrl);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // 2. Prepare Nanonets FormData
    const form = new FormData();
    form.append("file", Buffer.from(pdfBuffer), "catalog.pdf");

    // 3. Send PDF to Nanonets OCR
    const nnResponse = await fetch(
      `https://app.nanonets.com/api/v2/OCR/Model/${MODEL_ID}/LabelFile/`,
      {
        method: "POST",
        body: form,
        headers: {
          Authorization:
            "Basic " + Buffer.from(API_KEY + ":").toString("base64"),
        },
      }
    );

    const data = await nnResponse.json();

    if (!data.result || !data.result[0] || !data.result[0].page_data) {
      return res.json({
        success: false,
        error: "Invalid OCR response from Nanonets",
      });
    }

    // 4. Extract text from requested page
    const pageData = data.result[0].page_data.find(
      (p) => p.page === Number(page)
    );

    if (!pageData) {
      return res.json({
        success: false,
        error: "Page not found in OCR output",
      });
    }

    const extractedText = pageData.text || "";

    return res.json({
      success: true,
      text: extractedText,
    });
  } catch (err) {
    return res.json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(3000, () => console.log("PDF API running on port 3000"));
