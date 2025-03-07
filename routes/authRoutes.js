// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Debug: Log the value of JWT_SECRET
console.log('JWT_SECRET in authRoutes:', process.env.JWT_SECRET);

// Ensure JWT_SECRET is defined
const JWT_SECRET = process.env.JWT_SECRET || 'temporary-fallback-for-debugging';

// Check if JWT_SECRET is properly defined
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'undefined') {
  console.warn('WARNING: JWT_SECRET is not defined in environment variables or is invalid. Using a fallback for debugging.');
}

// Signup Route
router.post('/signup', async (req, res) => {
  const { email, username, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, username, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    if (req.redisClient) {
      await req.redisClient.set(`token:${user._id}`, token, 'EX', 3600);
    }

    res.status(201).json({ message: 'User created', token });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  console.log('Login request body:', req.body);
  const { identifier, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    if (req.redisClient) {
      await req.redisClient.set(`token:${user._id}`, token, 'EX', 3600);
    }

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Verify Token Route
router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (req.redisClient) {
      const cachedToken = await req.redisClient.get(`token:${decoded.id}`);
      if (cachedToken !== token) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }
    res.json({ message: 'Token is valid', userId: decoded.id });
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;