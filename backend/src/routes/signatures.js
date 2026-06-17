import express from "express";
import { Signature } from "../models/Signature.js";
import { Document } from "../models/Document.js";
import { authMiddleware } from "../middleware/auth.js";
import { logAudit } from "../middleware/audit.js";

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { documentId, ...payload } = req.body;
    if (!documentId) {
      return res.status(400).json({ message: "documentId is required" });
    }

    const doc = await Document.findOne({ _id: documentId, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const signature = await Signature.findOneAndUpdate(
      {
        document: documentId,
        owner: req.user._id,
        field: payload.field || "signature",
      },
      {
        ...payload,
        document: documentId,
        owner: req.user._id,
      },
      { new: true, upsert: true, runValidators: true }
    );

    await logAudit(documentId, req.user._id, "SIGNATURE_SAVED", payload.field || "signature", req.ip);

    res.status(201).json(signature);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save signature" });
  }
});

router.get("/document/:documentId", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.documentId, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const signatures = await Signature.find({ document: req.params.documentId });
    res.json(signatures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch signatures" });
  }
});

router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const signature = await Signature.findOne({ _id: req.params.id, owner: req.user._id });
    if (!signature) {
      return res.status(404).json({ message: "Signature not found" });
    }

    signature.status = status || signature.status;
    await signature.save();

    if (status === "Signed") {
      await logAudit(signature.document, req.user._id, "SIGNATURE_SIGNED", null, req.ip);
    } else if (status === "Rejected") {
      await logAudit(
        signature.document,
        req.user._id,
        "SIGNATURE_REJECTED",
        rejectionReason || "",
        req.ip
      );
    }

    res.json(signature);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update signature status" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const signature = await Signature.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });
    if (!signature) {
      return res.status(404).json({ message: "Signature not found" });
    }
    res.json({ message: "Signature deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
