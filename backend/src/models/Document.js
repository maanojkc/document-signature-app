import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, default: "application/pdf" },
    status: {
      type: String,
      enum: ["Draft", "Pending", "Signed", "Rejected"],
      default: "Draft",
    },
    signedFilePath: { type: String },
  },
  { timestamps: true }
);

export const Document = mongoose.model("Document", documentSchema);
