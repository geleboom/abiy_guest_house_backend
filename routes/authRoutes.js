const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// REGISTER - Supports email OR phoneNumber
router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body;

  // Validation
  if (!name || !password || (!email && !phoneNumber)) {
    return res.status(400).json({ message: 'Name, password, and either email or phone number are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    // Check if user already exists (email or phone)
    let user = await User.findOne({
      $or: [
        email ? { email: email.toLowerCase() } : null,
        phone ? { phone } : null,
      ].filter(Boolean),
    });

    if (user) {
      return res.status(400).json({ message: 'User with this email or phone number already exists' });
    }

    // Create new user
    user = new User({
      name: name.trim(),
      email: email ? email.toLowerCase() : undefined,
      phone: phone ? phone.trim() : undefined,
      password, // hashed by pre-save hook
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// LOGIN - Now uses identifier (email OR phoneNumber)
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Identifier (email or phone) and password are required' });
  }

  try {
    // Find user by email OR phoneNumber (case-insensitive for email)
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password); // assuming comparePassword method in model
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, phoneNumber: user.phoneNumber },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Admin login (unchanged)
router.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // CHANGE THIS!

  if (username === adminUsername && password === adminPassword) {
    const token = jwt.sign(
      { id: 'admin', role: 'admin', username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    return res.json({ token });
  }

  return res.status(401).json({ message: 'Invalid admin credentials' });
});

module.exports = router;