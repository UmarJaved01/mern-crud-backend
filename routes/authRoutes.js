const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');

// Middleware
router.use(cookieParser());

// Debug: Log the value of JWT_SECRET
console.log('JWT_SECRET in authRoutes:', process.env.JWT_SECRET);

// Ensure JWT_SECRET is defined
const JWT_SECRET = process.env.JWT_SECRET || 'temporary-fallback-for-debugging';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'undefined') {
  console.warn('WARNING: JWT_SECRET is not defined in environment variables or is invalid. Using a fallback for debugging.');
}

// Generate Access Token
const generateAccessToken = (userId) => {
  try {
    if (!userId) throw new Error('User ID is undefined');
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  } catch (error) {
    console.error('Error generating access token:', error);
    throw new Error('Failed to generate access token');
  }
};

// Generate Refresh Token
const generateRefreshToken = () => {
  try {
    return uuidv4();
  } catch (error) {
    console.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
};

// Signup Route
router.post('/signup', async (req, res) => {
  const { email, username, password, confirmPassword } = req.body;

  console.log('Signup request body:', req.body);

  // Input validation
  if (!email || !username || !password || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log('Existing user found:', existingUser);
      return res.status(400).json({ message: 'Email or username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');

    // Save user to MongoDB
    const user = new User({ email, username, password: hashedPassword });
    await user.save();
    console.log('User saved to MongoDB:', user._id);

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    console.log('Tokens generated:', { accessToken, refreshToken });

    // Store tokens in Redis (optional)
    if (req.redisClient) {
      try {
        await req.redisClient.set(`refreshToken:${user._id}`, refreshToken, 'EX', 7 * 24 * 60 * 60); // 7 days
        await req.redisClient.set(`accessToken:${user._id}`, accessToken, 'EX', 15 * 60); // 15 minutes
        console.log('Tokens stored in Redis');
      } catch (redisError) {
        console.error('Redis error during signup:', redisError);
        // Continue without Redis
      }
    } else {
      console.warn('Redis client is not available');
    }

    // Set the refresh token as an HttpOnly cookie
    if (typeof res.cookie !== 'function') {
      console.error('res.cookie is not a function - ensure cookie-parser middleware is applied');
      throw new Error('Cookie parser middleware not applied');
    }
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    console.log('Refresh token cookie set');

    res.status(201).json({ message: 'User created', accessToken });
  } catch (error) {
    console.error('Signup error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
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

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();

    // Store the refresh token in Redis
    if (req.redisClient) {
      await req.redisClient.set(`refreshToken:${user._id}`, refreshToken, 'EX', 7 * 24 * 60 * 60); // 7 days
      await req.redisClient.set(`accessToken:${user._id}`, accessToken, 'EX', 15 * 60); // 15 minutes
    }

    // Set the refresh token as an HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      sameSite: 'strict', // Prevent CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    res.json({ message: 'Login successful', accessToken });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Refresh Token Route
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken; // Get refresh token from cookie

  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  try {
    // Find the user associated with the refresh token
    let userId = null;
    if (req.redisClient) {
      const keys = await req.redisClient.keys('refreshToken:*');
      for (const key of keys) {
        const storedToken = await req.redisClient.get(key);
        if (storedToken === refreshToken) {
          userId = key.split(':')[1]; // Extract userId from key (e.g., refreshToken:userId)
          break;
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // Generate a new access token
    const newAccessToken = generateAccessToken(userId);

    // Update the access token in Redis
    if (req.redisClient) {
      await req.redisClient.set(`accessToken:${userId}`, newAccessToken, 'EX', 15 * 60); // 15 minutes
    }

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Verify Token Route (Optional, can be removed if not needed)
router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (req.redisClient) {
      const cachedToken = await req.redisClient.get(`accessToken:${decoded.id}`);
      if (cachedToken !== token) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }
    res.json({ message: 'Token is valid', userId: decoded.id });
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    // Clear the refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (req.redisClient) {
        await req.redisClient.del(`accessToken:${decoded.id}`);
        await req.redisClient.del(`refreshToken:${decoded.id}`);
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;