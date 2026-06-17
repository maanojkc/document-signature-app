import express from "express";
import { v4 as uuidv4 } from "uuid";
import { Recipient } from "../models/Recipient.js";
import { Document } from "../models/Document.js";
import { authMiddleware } from "../middleware/auth.js";
import { logAudit } from "../middleware/audit.js";

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { documentId, name, email, role } = req.body;
    if (!documentId || !name || !email) {
      return res.status(400).json({ message: "documentId, name, and email are required" });
    }

    const doc = await Document.findOne({ _id: documentId, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const recipient = await Recipient.create({
      document: documentId,
      owner: req.user._id,
      name,
      email,
      role: role || "Signer",
      signToken: uuidv4(),
    });

    if (doc.status === "Draft") {
      doc.status = "Pending";
      await doc.save();
    }

    await logAudit(documentId, req.user._id, "RECIPIENT_ADDED", email, req.ip);

    res.status(201).json(recipient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add recipient" });
  }
});

router.get("/document/:documentId", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.documentId, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const recipients = await Recipient.find({ document: req.params.documentId });
    res.json(recipients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch recipients" });
  }
});

router.post("/:id/remind", authMiddleware, async (req, res) => {
  try {
    const recipient = await Recipient.findOne({ _id: req.params.id, owner: req.user._id });
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const signLink = `${process.env.CLIENT_URL}/sign/${recipient.signToken}`;
    // Mock email — replace with nodemailer in production
    console.log(`[MOCK EMAIL] Reminder to ${recipient.email}: ${signLink}`);

    await logAudit(recipient.document, req.user._id, "REMINDER_SENT", recipient.email, req.ip);

    res.json({ message: "Reminder sent (mock)", signLink });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send reminder" });
  }
});

router.get("/public/:token", async (req, res) => {
  try {
    const recipient = await Recipient.findOne({ signToken: req.params.token }).populate(
      "document",
      "originalName status"
    );
    if (!recipient || !recipient.document) {
      return res.status(404).json({ message: "Signing link not found" });
    }

    res.json({
      recipient: {
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        status: recipient.status,
        rejectionReason: recipient.rejectionReason,
      },
      document: {
        id: recipient.document._id,
        originalName: recipient.document.originalName,
        status: recipient.document.status,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load signing link" });
  }
});

router.post("/public/:token/status", async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!["Signed", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be Signed or Rejected" });
    }

    const recipient = await Recipient.findOne({ signToken: req.params.token });
    if (!recipient) {
      return res.status(404).json({ message: "Signing link not found" });
    }

    recipient.status = status;
    recipient.rejectionReason = status === "Rejected" ? rejectionReason || "" : undefined;
    await recipient.save();

    const remaining = await Recipient.countDocuments({
      document: recipient.document,
      status: { $ne: "Signed" },
    });
    await Document.findByIdAndUpdate(recipient.document, {
      status: status === "Rejected" ? "Rejected" : remaining === 0 ? "Signed" : "Pending",
    });

    await logAudit(
      recipient.document,
      null,
      `PUBLIC_RECIPIENT_${status.toUpperCase()}`,
      `${recipient.email}${rejectionReason ? `: ${rejectionReason}` : ""}`,
      req.ip
    );

    res.json({ message: `Document ${status.toLowerCase()}`, recipient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update signing status" });
  }
});

router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const recipient = await Recipient.findOne({ _id: req.params.id, owner: req.user._id });
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    recipient.status = status || recipient.status;
    if (rejectionReason) recipient.rejectionReason = rejectionReason;
    await recipient.save();

    await logAudit(
      recipient.document,
      req.user._id,
      `RECIPIENT_${status?.toUpperCase() || "UPDATED"}`,
      recipient.email,
      req.ip
    );

    res.json(recipient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update recipient" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const recipient = await Recipient.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }
    res.json({ message: "Recipient removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
