const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// 1. Pre-Flight Checks & Middlewares
const upload = require('./utils/upload');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors()); // Enable CORS for any origin (Production Ready)
app.use(express.json());
app.use('/uploads', express.static('public/uploads'));

// 2. Routes
app.use('/api', require('./routes/api'));

// 3. Environment & Port Config
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// 4. Server Initialization logic
const startServer = async () => {
  try {
    if (!MONGO_URI) {
      console.error('CRITICAL ERROR: MONGO_URI environment variable is missing.');
      process.exit(1); 
    }

    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Fail fast if DB is disconnected
    });
    console.log('Connected to MongoDB successfully');

    // Only start listening once the DB is ready
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT} (Host: 0.0.0.0)`);
    });

  } catch (error) {
    console.error('SERVER STARTUP FAILED:');
    console.error('-----------------------');
    console.error(error.message);
    if (error.name === 'MongooseServerSelectionError') {
      console.error('Check your MongoDB IP whitelist and connection string.');
    }
    // Exit with status 1 to tell the cloud provider the app failed
    process.exit(1);
  }
};

startServer();

module.exports = { app, upload };
