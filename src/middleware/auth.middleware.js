const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Authenticate user with JWT
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check cookies / queries if needed (as fallback)
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_certificate_system_jwt_token_key_123!');

    // Find user by ID and verify they are active
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'User account is deactivated' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
  }
};

// Check if user has required role(s)
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user ? req.user.role : 'Guest'}' is not authorized to access this resource`
      });
    }
    next();
  };
};

// Check if user has specific permission
exports.requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role === 'SuperAdmin') {
      return next(); // SuperAdmin overrides all permissions
    }
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `You do not have the required permission: ${permission}`
      });
    }
    next();
  };
};
