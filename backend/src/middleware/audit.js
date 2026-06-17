import { AuditLog } from "../models/AuditLog.js";

export const logAudit = async (documentId, userId, action, details, ipAddress) => {
  await AuditLog.create({
    document: documentId,
    user: userId,
    action,
    details,
    ipAddress,
  });
};

export const auditMiddleware = (action, detailsFn) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400 && req.params.id) {
      logAudit(
        req.params.id,
        req.user?._id,
        action,
        typeof detailsFn === "function" ? detailsFn(req, body) : detailsFn,
        req.ip
      ).catch(console.error);
    }
    return originalJson(body);
  };
  next();
};
