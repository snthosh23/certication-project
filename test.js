// Module Compile and Reference Verification Script
const fs = require('fs');
const path = require('path');

console.log('Starting compilation and import validations...');

try {
  // Test local .env configuration loading
  require('dotenv').config();
  console.log('✓ dotenv initialized.');

  // Test Model Imports
  const User = require('./src/models/user.model');
  const Certificate = require('./src/models/certificate.model');
  const VerificationLog = require('./src/models/verificationLog.model');
  const AuditLog = require('./src/models/auditLog.model');
  console.log('✓ All database schemas compiled successfully.');

  // Test Utilities
  const { generateQRCode } = require('./src/utils/qrGenerator');
  const { generateCertificatePDF } = require('./src/utils/pdfGenerator');
  const { sendCertificateEmail } = require('./src/utils/emailSender');
  console.log('✓ All utility modules resolved successfully.');

  // Test Middlewares
  const authMiddleware = require('./src/middleware/auth.middleware');
  const errorMiddleware = require('./src/middleware/error.middleware');
  const uploadMiddleware = require('./src/middleware/upload.middleware');
  console.log('✓ All middleware modules resolved successfully.');

  // Test Controllers
  const authController = require('./src/controllers/auth.controller');
  const certificateController = require('./src/controllers/certificate.controller');
  const analyticsController = require('./src/controllers/analytics.controller');
  const userController = require('./src/controllers/user.controller');
  console.log('✓ All controller modules resolved successfully.');

  // Test database initializer connection script
  const connectDB = require('./src/db');
  console.log('✓ Database connector resolved.');

  console.log('\n=======================================');
  console.log('ALL MODULE COMPILATIONS PASSED SUCCESSFULLY! 🎉');
  console.log('Your Certificate System is ready to run.');
  console.log('=======================================');

} catch (err) {
  console.error('\n❌ MODULE COMPILATION OR IMPORT FAILED:');
  console.error(err);
  process.exit(1);
}
