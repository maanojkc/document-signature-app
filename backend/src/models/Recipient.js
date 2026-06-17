import mongoose from "mongoose";

const recipientSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    role: { type: String, enum: ["Signer", "Approver", "Viewer"], default: "Signer" },
    status: {
      type: String,
      enum: ["Pending", "Signed", "Rejected"],
      default: "Pending",
    },
    signToken: { type: String, unique: true, sparse: true },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

export const Recipient = mongoose.model("Recipient", recipientSchema);
