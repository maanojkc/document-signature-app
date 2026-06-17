import express from "express";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import { Document } from "../models/Document.js";
import { Signature } from "../models/Signature.js";
import { authMiddleware } from "../middleware/auth.js";
import { uploadDir } from "../middleware/upload.js";
import { logAudit } from "../middleware/audit.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
};

const base64ToUint8Array = (base64) => {
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  return Uint8Array.from(Buffer.from(base64Data, "base64"));
};

router.post("/:documentId/generate", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.documentId, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const signatures = await Signature.find({ document: doc._id });
    const existingPdfBytes = fs.readFileSync(doc.filePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    for (const sig of signatures) {
      const pageIndex = Math.max(0, (sig.page || 1) - 1);
      const targetPage = pages[pageIndex] || pages[0];
      const { width: pdfPageWidth, height: pdfPageHeight } = targetPage.getSize();
      const zoom = sig.zoom || 1;
      const scale = pdfPageWidth / (850 * zoom);
      const { x, y, width, height } = sig.coordinates;

      if (sig.field === "signature" && sig.signatureType === "text" && sig.signatureText) {
        targetPage.drawText(sig.signatureText, {
          x: x * scale,
          y: pdfPageHeight - y * scale - height * scale,
          size: (sig.fontSize || 48) * scale,
          color: hexToRgb(sig.color || "#000000"),
        });
      } else if (sig.field === "signature" && sig.signatureType === "drawn" && sig.drawnSignatureUrl) {
        const imageBytes = base64ToUint8Array(sig.drawnSignatureUrl);
        const pngImage = await pdfDoc.embedPng(imageBytes);
        targetPage.drawImage(pngImage, {
          x: x * scale,
          y: pdfPageHeight - y * scale - height * scale,
          width: width * scale,
          height: height * scale,
        });
      } else if (sig.field === "date" && sig.signatureText) {
        targetPage.drawText(sig.signatureText, {
          x: x * scale,
          y: pdfPageHeight - y * scale - height * scale,
          size: (sig.fontSize || 38) * scale,
          color: hexToRgb(sig.color || "#000000"),
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const signedFileName = `signed-${uuidv4()}.pdf`;
    const signedFilePath = path.join(uploadDir, signedFileName);
    fs.writeFileSync(signedFilePath, pdfBytes);

    doc.signedFilePath = signedFilePath;
    doc.status = "Signed";
    await doc.save();

    await logAudit(doc._id, req.user._id, "PDF_GENERATED", signedFileName, req.ip);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="signed-${doc.originalName}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate signed PDF" });
  }
});

export default router;
