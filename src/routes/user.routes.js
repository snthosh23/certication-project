const express = require('express');
const router = express.Router();
const {
  getUsers,
  createUser,
  toggleUserStatus,
  updateUserRole,
  updateProfile
} = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.use(protect);

// Own profile edit
router.put('/profile', updateProfile);

// Admin account management routes (SuperAdmin restricted)
router.use(restrictTo('SuperAdmin'));
router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id/status', toggleUserStatus);
router.put('/:id/role', updateUserRole);

module.exports = router;
