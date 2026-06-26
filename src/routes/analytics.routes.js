const express = require('express');
const router = express.Router();
const { getDashboardData, getAuditLogs, getVerificationLogs } = require('../controllers/analytics.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Public endpoints
router.get('/verifications', getVerificationLogs);

router.use(protect);

router.get('/dashboard', getDashboardData);
router.get('/audit', restrictTo('SuperAdmin'), getAuditLogs);

module.exports = router;
