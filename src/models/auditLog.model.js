const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true // e.g. 'LOGIN', 'ISSUE_CERTIFICATE', 'REVOKE_CERTIFICATE', 'DELETE_CERTIFICATE', 'CREATE_USER'
    },
    targetType: {
      type: String,
      required: true // e.g. 'Certificate', 'User', 'System'
    },
    targetId: {
      type: String
    },
    details: {
      type: String
    },
    ipAddress: {
      type: String,
      default: 'Unknown'
    }
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false }
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
