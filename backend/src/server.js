import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import docsRoutes from "./routes/docs.js";
import signaturesRoutes from "./routes/signatures.js";
import recipientsRoutes from "./routes/recipients.js";
import exportRoutes from "./routes/export.js";
import draftsRoutes from "./routes/drafts.js";
import auditRoutes from "./routes/audit.js";

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "SignFlow API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/docs", docsRoutes);
app.use("/api/signatures", signaturesRoutes);
app.use("/api/recipients", recipientsRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/drafts", draftsRoutes);
app.use("/api/audit", auditRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const start = async () => {
  await connectDB();
  app.listen(PORT, "0.0.0.0", () => {
  console.log(`SignFlow API running on port ${PORT}`);
});
};

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
