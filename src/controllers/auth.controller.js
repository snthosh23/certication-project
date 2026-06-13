const User = require('../models/user.model');
const AuditLog = require('../models/auditLog.model');
const jwt = require('jsonwebtoken');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_certificate_system_jwt_token_key_123!', {
    expiresIn: '30d' // 30 days expiry for dashboard session ease
  });
};

// Register first user as SuperAdmin, others as Admin
exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Username or Email already registered' });
    }

    // Determine role (first user = SuperAdmin)
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'SuperAdmin' : 'Admin';
    const permissions = role === 'SuperAdmin' 
      ? ['issue_certificate', 'revoke_certificate', 'delete_certificate', 'manage_users', 'verify_certificate'] 
      : ['issue_certificate', 'revoke_certificate', 'verify_certificate'];

    const user = await User.create({
      username,
      email,
      password,
      role,
      permissions
    });

    const token = signToken(user._id);

    // Create Audit Log
    await AuditLog.create({
      userId: user._id,
      username: user.username,
      action: 'REGISTER',
      targetType: 'User',
      targetId: user._id.toString(),
      details: `Registered as ${role}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Find user by email and select password explicitly
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user._id);

    // Create Audit Log
    await AuditLog.create({
      userId: user._id,
      username: user.username,
      action: 'LOGIN',
      targetType: 'User',
      targetId: user._id.toString(),
      details: 'Logged in successfully',
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current logged in user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};
