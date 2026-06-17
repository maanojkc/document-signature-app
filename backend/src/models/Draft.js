import mongoose from "mongoose";

const draftSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    signatureText: { type: String },
    fontFamily: { type: String },
    fontSize: { type: Number },
    color: { type: String },
    showSignature: { type: Boolean, default: false },
    showDate: { type: Boolean, default: false },
    dateText: { type: String },
    position: { x: Number, y: Number },
    size: { width: Number, height: Number },
    datePosition: { x: Number, y: Number },
    dateSize: { width: Number, height: Number },
    signatureType: { type: String, enum: ["text", "drawn"], default: "text" },
    drawnSignatureUrl: { type: String },
    zoom: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Draft = mongoose.model("Draft", draftSchema);
