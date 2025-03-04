const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv')
const personRoutes = require('./routes/personRoutes')

// Load environment variables from .env file (if present locally)
dotenv.config()

const app = express()

// Middleware
app.use(express.json())

// CORS configuration to allow the frontend domain
app.use(cors({
  origin: ['https://merncrudfrontend.z23.web.core.windows.net','http://localhost:5173'], // Your frontend Storage Account URL (updated)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Include headers as needed
  credentials: false // Set to true if sending cookies or auth tokens
}))

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// Routes
app.use('/api/persons', personRoutes)

// Health check endpoint (for debugging)
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running', mongoConnected: mongoose.connection.readyState === 1 });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});