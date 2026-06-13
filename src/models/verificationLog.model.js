const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      index: true
    },
    certificateRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Certificate'
    },
    ipAddress: {
      type: String,
      default: 'Unknown'
    },
    userAgent: {
      type: String,
      default: 'Unknown'
    },
    status: {
      type: String,
      enum: ['Success', 'Failed'],
      required: true
    },
    details: {
      type: String
    }
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false }
  }
);

module.exports = mongoose.model('VerificationLog', verificationLogSchema);
