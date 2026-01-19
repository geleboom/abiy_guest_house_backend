const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');      // your JWT middleware
const adminMiddleware = require('../middleware/admin');    // admin role check

// GET /api/users - List all registered users (admin only)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')  // Never return passwords!
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// GET /api/users/count - Total number of users (admin only)
router.get('/count', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error('Error counting users:', err);
    res.status(500).json({ message: 'Server error counting users' });
  }
});

module.exports = router;