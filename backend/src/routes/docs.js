import express from "express";
import fs from "fs";
import path from "path";
import { Document } from "../models/Document.js";
import { authMiddleware } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { logAudit } from "../middleware/audit.js";

const router = express.Router();

router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "PDF file is required" });
    }

    const doc = await Document.create({
      owner: req.user._id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    await logAudit(doc._id, req.user._id, "DOCUMENT_UPLOADED", req.file.originalname, req.ip);

    res.status(201).json({
      id: doc._id,
      originalName: doc.originalName,
      fileSize: doc.fileSize,
      status: doc.status,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .select("-filePath -signedFilePath");

    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch document" });
  }
});

router.get("/:id/file", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const filePath = doc.signedFilePath || doc.filePath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to serve file" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    [doc.filePath, doc.signedFilePath].filter(Boolean).forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    await doc.deleteOne();
    await logAudit(req.params.id, req.user._id, "DOCUMENT_DELETED", doc.originalName, req.ip);

    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
