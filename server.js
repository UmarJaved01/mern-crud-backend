// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Redis = require('ioredis');

// Load environment variables from .env file
dotenv.config();

// Debug: Log the path of the .env file and loaded environment variables
console.log('Dotenv config loaded:', dotenv.config());
console.log('Loaded environment variables:', {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
});

// Require routes after dotenv config
const personRoutes = require('./routes/personRoutes');
const authRoutes = require('./routes/authRoutes');

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

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err.message));

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