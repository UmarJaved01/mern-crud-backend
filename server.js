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
const redisConnectionString = process.env.REDIS_CONNECTION_STRING;
let redisClient;

try {
  if (redisConnectionString) {
    console.log('Redis connection string from env:', redisConnectionString);
    redisClient = new Redis(redisConnectionString);
  } else {
    throw new Error('REDIS_CONNECTION_STRING is not set in environment variables');
  }

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
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
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