// ===== PDF.js Module Import =====
import * as pdfjsLib from "./lib/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdf.worker.mjs";

/* ===== Escape HTML ===== */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ===== Normalize Text ===== */
function normalizeText(text) {
  return text
    .replace(/\s+/g, " ") // collapse multiple spaces
    .replace(/\n+/g, "\n") // collapse multiple newlines
    .trim();
}

/* ===== Render PDF Pages in Container ===== */
async function renderPDF(file, containerId) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.2 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    container.appendChild(canvas);

    const renderContext = {
      canvasContext: canvas.getContext("2d"),
      viewport: viewport,
    };
    await page.render(renderContext).promise;
  }
}

/* ===== Extract Text from PDF with OCR Fallback ===== */
async function extractText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    // Try normal text extraction
    const content = await page.getTextContent();
    let pageText = content.items.map((item) => item.str).join(" ");

    // If no text, fallback to OCR
    if (!pageText.trim()) {
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");

      await page.render({ canvasContext: ctx, viewport }).promise;

      // OCR using Tesseract.js
      const {
        data: { text },
      } = await Tesseract.recognize(canvas, "eng", {
        logger: (m) => console.log(`OCR Page ${i}:`, m.status, m.progress),
      });
      pageText = text;
    }

    fullText += pageText + "\n"; // page break
  }

  return normalizeText(fullText);
}

/* ===== Compare PDFs Function ===== */
async function comparePDFs() {
  const file1 = document.getElementById("pdf1").files[0];
  const file2 = document.getElementById("pdf2").files[0];

  if (!file1 || !file2) {
    alert("Please upload both PDFs");
    return;
  }

  // Show loading
  document.getElementById("diffResult").innerHTML =
    "<b>Comparing PDFs, please wait...</b>";

  // Render PDFs visually
  await renderPDF(file1, "pdf1-view");
  await renderPDF(file2, "pdf2-view");

  // Extract text (PDF.js + OCR fallback)
  const text1 = await extractText(file1);
  const text2 = await extractText(file2);

  if (!text1 && !text2) {
    document.getElementById("diffResult").innerHTML =
      "<b>No readable text found in PDFs.</b>";
    return;
  }

  // Diff logic
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(text1, text2);
  dmp.diff_cleanupSemantic(diffs);

  // Build HTML diff
  let diffHtml = "";
  diffs.forEach(([type, text]) => {
    if (type === 1)
      diffHtml += `<span class="diff-added">${escapeHtml(text)}</span>`;
    else if (type === -1)
      diffHtml += `<span class="diff-removed">${escapeHtml(text)}</span>`;
    else diffHtml += `<span>${escapeHtml(text)}</span>`;
  });

  document.getElementById("diffResult").innerHTML = diffHtml;
}

/* ===== Button Event ===== */
document.getElementById("compareBtn").addEventListener("click", comparePDFs);
