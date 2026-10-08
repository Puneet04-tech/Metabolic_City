import mongoose from 'mongoose';

/**
 * Audit Log Schema
 * Security Principle: Audit Logging - All actions logged with user, timestamp, and context
 */
const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String },
  userRole: { type: String },
  action: { type: String, required: true },
  method: { type: String },
  path: { type: String },
  statusCode: { type: Number },
  target: {
    type: { type: String }, // 'cell', 'incident', 'user', etc.
    id: { type: String },
  },
  context: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
});

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// Check if model already exists before defining (prevents hot reload errors)
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

/**
 * Audit Logging Middleware
 * Logs all successful API calls for security and compliance
 */
export function auditLogMiddleware(req, res, next) {
  const originalSend = res.send;
  const startTime = Date.now();

  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Only log successful requests (status < 400)
    if (res.statusCode < 400 && req.user) {
      const logData = {
        userId: req.user._id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: `${req.method} ${req.path}`,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        context: {
          duration: `${duration}ms`,
          body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      // Add target information if available
      if (req.params.h3Index) {
        logData.target = { type: 'cell', id: req.params.h3Index };
      }
      if (req.params.incidentId) {
        logData.target = { type: 'incident', id: req.params.incidentId };
      }
      if (req.params.userId) {
        logData.target = { type: 'user', id: req.params.userId };
      }

      // Log asynchronously (don't block response)
      AuditLog.create(logData).catch((err) => {
        console.error('[Audit Log] Failed to create log:', err.message);
      });
    }

    originalSend.call(this, data);
  };

  next();
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeBody(body) {
  if (!body) return undefined;
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(userId, limit = 100) {
  return AuditLog.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
}

/**
 * Get audit logs for a specific action
 */
export async function getActionAuditLogs(action, limit = 100) {
  return AuditLog.find({ action })
    .sort({ timestamp: -1 })
    .limit(limit);
}

/**
 * Get recent audit logs (for admin monitoring)
 */
export async function getRecentAuditLogs(hours = 24, limit = 1000) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return AuditLog.find({ timestamp: { $gte: cutoff } })
    .sort({ timestamp: -1 })
    .limit(limit);
}
