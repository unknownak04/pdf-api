import express from "express";
import fetch from "node-fetch";
import pdfjs from "pdfjs-dist/legacy/build/pdf.js";

const app = express();
app.use(express.json());

app.post("/extract", async (req, res) => {
  try {
    const { pdfUrl, page } = req.body;

    const pdfData = await fetch(pdfUrl).then(r => r.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data: pdfData }).promise;

    if (page < 1 || page > pdf.numPages) {
      return res.json({ error: "Invalid page" });
    }

    const p = await pdf.getPage(page);
    const content = await p.getTextContent();
    const text = content.items.map(i => i.str).join(" ");

    res.json({ text });
  } catch (e) {
    res.json({ error: e.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on " + PORT));
