import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    details: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
