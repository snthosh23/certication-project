const User = require('../models/user.model');
const AuditLog = require('../models/auditLog.model');

// 1. Get all users (SuperAdmin only)
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    next(error);
  }
};

// 2. Create sub-user/admin (SuperAdmin only)
exports.createUser = async (req, res, next) => {
  try {
    const { username, email, password, role, permissions } = req.body;

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Username or Email already registered' });
    }

    const newUser = await User.create({
      username,
      email,
      password,
      role: role || 'Admin',
      permissions: permissions || ['issue_certificate', 'verify_certificate']
    });

    // Create Audit Log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'CREATE_USER',
      targetType: 'User',
      targetId: newUser._id.toString(),
      details: `Created administrative user ${username} with role ${newUser.role}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      success: true,
      message: 'User profile created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        permissions: newUser.permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

// 3. Toggle user active status (SuperAdmin only)
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own profile' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    // Create Audit Log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: user.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      targetType: 'User',
      targetId: id,
      details: `${user.isActive ? 'Activated' : 'Deactivated'} username: ${user.username}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(200).json({
      success: true,
      message: `User profile is now ${user.isActive ? 'active' : 'deactivated'}`,
      user: {
        id: user._id,
        username: user.username,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

// 4. Update role and permissions (SuperAdmin only)
exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, permissions } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (role) user.role = role;
    if (permissions) user.permissions = permissions;

    await user.save();

    // Create Audit Log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'UPDATE_USER_ROLE',
      targetType: 'User',
      targetId: id,
      details: `Updated role to: ${user.role} and permissions: ${user.permissions.join(', ')}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(200).json({
      success: true,
      message: 'User permissions updated successfully',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

// 5. Update logged-in user profile (Own profile)
exports.updateProfile = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (password) user.password = password; // Pre-save hook will hash it

    await user.save();

    // Create Audit Log
    await AuditLog.create({
      userId: user._id,
      username: user.username,
      action: 'UPDATE_PROFILE',
      targetType: 'User',
      targetId: user._id.toString(),
      details: 'Updated own profile details',
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};
