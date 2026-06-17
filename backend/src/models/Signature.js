import mongoose from "mongoose";

const signatureSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    field: { type: String, enum: ["signature", "date"], default: "signature" },
    signatureType: { type: String, enum: ["text", "drawn"], default: "text" },
    signatureText: { type: String },
    drawnSignatureUrl: { type: String },
    fontFamily: { type: String },
    fontSize: { type: Number },
    color: { type: String },
    page: { type: Number, default: 1 },
    coordinates: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    zoom: { type: Number, default: 1 },
    signer: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Signed", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export const Signature = mongoose.model("Signature", signatureSchema);
