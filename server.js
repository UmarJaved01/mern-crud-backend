const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const personRoutes = require('./routes/personRoutes');
const Redis = require('ioredis');

// Load environment variables from .env file (if present locally)
dotenv.config();

const app = express();

// Redis connection
const redisConnectionString = process.env.REDIS_CONNECTION_STRING; // e.g., from Azure portal
const redisClient = new Redis(redisConnectionString || {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined // Enable TLS for Azure Redis
});

redisClient.on('connect', () => {
  console.log('Redis connected successfully');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

// Middleware
app.use(express.json());

// CORS configuration to allow the frontend domain
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

// Pass Redis client to routes
app.use('/api/persons', (req, res, next) => {
  req.redisClient = redisClient; // Attach redisClient to the request object
  next();
}, personRoutes);

// Health check endpoint (for debugging)
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running', mongoConnected: mongoose.connection.readyState === 1 });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});