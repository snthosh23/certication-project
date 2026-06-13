const express = require('express');
const router = express.Router();
const {
  issueCertificate,
  bulkIssueCertificates,
  updateCertificate,
  revokeCertificate,
  deleteCertificate,
  verifyCertificate,
  getCertificates,
  downloadPDF,
  sendEmail,
  exportCSV
} = require('../controllers/certificate.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Public endpoints
router.get('/verify/:id', verifyCertificate);
router.get('/download/:id', downloadPDF);

// Admin / SuperAdmin protected endpoints
router.use(protect);

router.get('/', getCertificates);
router.post(
  '/',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'backgroundImage', maxCount: 1 }
  ]),
  issueCertificate
);
router.post('/bulk', upload.single('csvFile'), bulkIssueCertificates);
router.put('/:id', updateCertificate);
router.put('/:id/revoke', revokeCertificate);
router.delete('/:id', restrictTo('SuperAdmin'), deleteCertificate);
router.post('/:id/email', sendEmail);
router.get('/export/csv', exportCSV);

module.exports = router;
