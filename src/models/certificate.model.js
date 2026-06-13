const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    recipientName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true
    },
    recipientEmail: {
      type: String,
      required: [true, 'Recipient email is required'],
      trim: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    courseName: {
      type: String,
      required: [true, 'Course/Title is required'],
      trim: true
    },
    organization: {
      type: String,
      default: 'Digital Certification Authority'
    },
    issueDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['Valid', 'Revoked'],
      default: 'Valid'
    },
    qrCodeUrl: {
      type: String // URL or Base64 data of generated QR code
    },
    verificationCount: {
      type: Number,
      default: 0
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    templateConfig: {
      templateId: { type: String, default: 'default' },
      backgroundColor: { type: String, default: '#ffffff' },
      primaryColor: { type: String, default: '#2563eb' },
      secondaryColor: { type: String, default: '#7c3aed' },
      logoUrl: { type: String },
      backgroundImageUrl: { type: String },
      customText: { type: String }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Certificate', certificateSchema);
