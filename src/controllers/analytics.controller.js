const Certificate = require('../models/certificate.model');
const VerificationLog = require('../models/verificationLog.model');
const AuditLog = require('../models/auditLog.model');
const User = require('../models/user.model');

// 1. Get Dashboard Analytics Counters and Charts Data
exports.getDashboardData = async (req, res, next) => {
  try {
    // Total certificates issued
    const totalIssued = await Certificate.countDocuments();

    // Total verification attempts (both successful and failed)
    const totalVerifications = await VerificationLog.countDocuments();

    // Active admin/user profiles
    const activeUsers = await User.countDocuments({ isActive: true });

    // Status breakdown (Valid vs Revoked)
    const validCount = await Certificate.countDocuments({ status: 'Valid' });
    const revokedCount = await Certificate.countDocuments({ status: 'Revoked' });

    // Course certificate breakdown (Top 5 courses)
    const courseBreakdown = await Certificate.aggregate([
      { $group: { _id: '$courseName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Recent 5 activity logs (audit)
    const recentActivities = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(5);

    // Recent 5 verification hits
    const recentVerifications = await VerificationLog.find()
      .populate('certificateRef', 'recipientName courseName')
      .sort({ timestamp: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      counters: {
        totalIssued,
        totalVerifications,
        activeUsers
      },
      charts: {
        statusBreakdown: {
          valid: validCount,
          revoked: revokedCount
        },
        courseBreakdown: courseBreakdown.map(c => ({
          course: c._id,
          count: c.count
        }))
      },
      recentActivities,
      recentVerifications
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Full Audit Logs (Administrative actions logs)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const skipIdx = (page - 1) * limit;

    const total = await AuditLog.countDocuments();
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .skip(skipIdx)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      logs
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Public Verification Logs (Verification history page)
exports.getVerificationLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const skipIdx = (page - 1) * limit;

    const total = await VerificationLog.countDocuments();
    const logs = await VerificationLog.find()
      .populate('certificateRef', 'recipientName courseName')
      .sort({ timestamp: -1 })
      .skip(skipIdx)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      logs
    });
  } catch (error) {
    next(error);
  }
};
