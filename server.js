const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const personRoutes = require('./routes/personRoutes');
const Redis = require('ioredis');

// Load environment variables from .env file
dotenv.config();

const app = express();

// Redis connection (using Azure Cache for Redis)
let redisClient;

try {
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisTls = process.env.REDIS_TLS === 'true';

  if (!redisHost) {
    throw new Error('REDIS_HOST is not set in environment variables');
  }

  console.log('Attempting to connect to Redis with config:', {
    host: redisHost,
    port: redisPort,
    tls: redisTls
  });

  redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    tls: redisTls ? {} : undefined // Enable TLS if REDIS_TLS is true
  });

  redisClient.on('connect', () => {
    console.log('Redis connected successfully');
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err.message);
    redisClient = null; // Set to null if connection fails
  });
} catch (err) {
  console.error('Failed to initialize Redis client:', err.message);
  redisClient = null; // Fallback if initialization fails
}

// Middleware
app.use(express.json());

// CORS configuration
app.use(cors({
  origin: ['https://merncrudfrontend.z23.web.core.windows.net', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// Pass Redis client to routes (or null if unavailable)
app.use('/api/persons', (req, res, next) => {
  req.redisClient = redisClient;
  next();
}, personRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'Backend is running',
    mongoConnected: mongoose.connection.readyState === 1,
    redisConnected: redisClient !== null && redisClient.status === 'ready'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});