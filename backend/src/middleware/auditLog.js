import mongoose from 'mongoose';

/**
 * Audit Log Schema
 * Security Principle: Audit Logging - All actions logged with user, timestamp, and context
 * 
 * Note: This schema must match backend/src/models/AuditLog.js to avoid conflicts
 * Fields: actorId, action, entityType, entityId, metadata, createdAt
 */
const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true },
});

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

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
      // Determine entity type from path and params
      let entityType = 'api';
      let entityId = null;
      
      if (req.params.h3Index) {
        entityType = 'cell';
        entityId = req.params.h3Index;
      } else if (req.params.incidentId) {
        entityType = 'incident';
        entityId = req.params.incidentId;
      } else if (req.params.userId) {
        entityType = 'user';
        entityId = req.params.userId;
      } else if (req.path.includes('/analytics')) {
        entityType = 'analytics';
      } else if (req.path.includes('/spatial-cells')) {
        entityType = 'spatialCell';
      } else if (req.path.includes('/telemetry')) {
        entityType = 'telemetry';
      }

      const logData = {
        actorId: req.user._id,
        action: `${req.method} ${req.path}`,
        entityType,
        entityId,
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userEmail: req.user.email,
          userRole: req.user.role,
          body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      };

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
