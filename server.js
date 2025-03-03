const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv')
const personRoutes = require('./routes/personRoutes')

// Load environment variables
dotenv.config()

const app = express()

// Middleware
app.use(express.json())

// Determine the environment (local or production)
const isLocal = process.env.NODE_ENV === 'development'

// CORS configuration based on environment
const corsOptions = {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}

if (isLocal) {
  // Local development: Allow localhost and any other testing origins
  corsOptions.origin = ['http://localhost:5173', 'https://merncrudfrontend.z23.web.core.windows.net']
  console.log('Running in development mode - CORS allows localhost and Azure frontend')
} else {
  // Production (Azure): Allow only the Azure frontend
  corsOptions.origin = process.env.FRONTEND_URL || 'https://merncrudfrontend.z23.web.core.windows.net'
  console.log('Running in production mode - CORS allows:', corsOptions.origin)
}

app.use(cors(corsOptions))

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err.message))

// Routes
app.use('/api/persons', personRoutes)

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`)
})