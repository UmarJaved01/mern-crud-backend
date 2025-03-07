const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Redis = require('ioredis');

// Load environment variables from .env file
dotenv.config();

// Debug: Log the loaded environment variables
console.log('Loaded environment variables:', {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_TLS: process.env.REDIS_TLS,
});

const app = express();

// Redis connection
let redisClient;
try {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisTls = process.env.REDIS_TLS === 'true';

  console.log('Attempting to connect to Redis with config:', {
    host: redisHost,
    port: redisPort,
    tls: redisTls,
  });

  redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    tls: redisTls ? {} : undefined,
  });

  redisClient.on('connect', () => {
    console.log('Redis connected successfully');
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err.message);
    redisClient = null;
  });
} catch (err) {
  console.error('Failed to initialize Redis client:', err.message);
  redisClient = null;
}

// Middleware
app.use(express.json());

// CORS configuration with credentials
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'https://merncrudfrontend.z23.web.core.windows.net',
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow credentials (cookies)
  optionsSuccessStatus: 200, // Some legacy browsers (IE) choke on 204
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(corsOptions));

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// Require routes after dotenv config
const personRoutes = require('./routes/personRoutes');
const authRoutes = require('./routes/authRoutes');

// Pass Redis client to routes
app.use('/api/persons', (req, res, next) => {
  req.redisClient = redisClient;
  next();
}, personRoutes);

app.use('/api/auth', (req, res, next) => {
  req.redisClient = redisClient;
  next();
}, authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'Backend is running',
    mongoConnected: mongoose.connection.readyState === 1,
    redisConnected: redisClient !== null && redisClient.status === 'ready',
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
