import express from "express"
import axios from "axios"
import fetch from "node-fetch"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js"
import { createCanvas } from "canvas"

const app = express()
app.use(express.json({ limit: "50mb" }))

// --- CONFIG ---
const NANONETS_MODEL_ID = "f01a98b5-ec47-4d1a-8b26-f11a1d5ec318"
const NANONETS_API_KEY = "cb5c4dd4-c2bf-11f0-98c9-1edd0239ff34"

// Load PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.js"

// ------------------------------
// DOWNLOAD PDF
// ------------------------------
async function downloadPDF(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download PDF: ${res.status}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

// ------------------------------
// EXTRACT TEXT USING PDF.js
// ------------------------------
async function extractTextFromPDF(buffer, pageNumber) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Invalid page number. PDF has ${pdf.numPages} pages.`)
  }

  const page = await pdf.getPage(pageNumber)
  const textContent = await page.getTextContent()

  let finalText = textContent.items.map((i) => i.str).join(" ").trim()

  return finalText
}

// ------------------------------
// FALLBACK: OCR USING NANONETS
// ------------------------------
async function extractWithNanoNets(buffer, pageNumber) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const page = await pdf.getPage(pageNumber)

  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(viewport.width, viewport.height)
  const context = canvas.getContext("2d")

  await page.render({ canvasContext: context, viewport }).promise

  const imgBase64 = canvas.toDataURL().split(",")[1]

  try {
    const response = await axios.post(
      `https://app.nanonets.com/api/v2/OCR/Model/${NANONETS_MODEL_ID}/LabelFile/`,
      {
        file: imgBase64
      },
      {
        auth: {
          username: NANONETS_API_KEY,
          password: ""
        },
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    )

    if (
      response.data &&
      response.data.result &&
      response.data.result.length > 0 &&
      response.data.result[0].prediction
    ) {
      return response.data.result[0].prediction
        .map((p) => p.ocr_text)
        .join("\n")
    }

    return ""
  } catch (err) {
    console.log("Nanonets OCR Error:", err.message)
    return ""
  }
}

// ------------------------------
// API ROUTE
// ------------------------------
app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body

    if (!pdfUrl || !page) {
      return res.status(400).json({ success: false, error: "Missing fields" })
    }

    const buffer = await downloadPDF(pdfUrl)

    // 1) Try PDF.js extraction
    let text = await extractTextFromPDF(buffer, page)

    // If no text → OCR fallback
    if (!text || text.trim().length < 5) {
      console.log("Using OCR fallback…")
      text = await extractWithNanoNets(buffer, page)
    }

    if (!text || text.trim().length === 0) {
      return res.json({ success: false, error: "Empty page or unreadable" })
    }

    return res.json({ success: true, text })
  } catch (err) {
    console.log("ERROR:", err.message)
    return res.json({ success: false, error: err.message })
  }
})

// ------------------------------
const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
