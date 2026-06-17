import express from "express";
import { Draft } from "../models/Draft.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const draft = await Draft.findOne({ user: req.user._id });
    res.json(draft || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch draft" });
  }
});

router.put("/", authMiddleware, async (req, res) => {
  try {
    const draft = await Draft.findOneAndUpdate(
      { user: req.user._id },
      { ...req.body, user: req.user._id },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(draft);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save draft" });
  }
});

export default router;
