import express from "express";
import { AuditLog } from "../models/AuditLog.js";
import { Document } from "../models/Document.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get("/:fileId", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.fileId, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const logs = await AuditLog.find({ document: req.params.fileId })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch audit trail" });
  }
});

export default router;
