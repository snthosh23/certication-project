require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./src/db');
const errorHandler = require('./src/middleware/error.middleware');

// Initialise Server
const app = express();

// Database Connection
connectDB();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure standard uploads directory is statically served
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Serve Frontend Static Site
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/certificates', require('./src/routes/certificate.routes'));
app.use('/api/users', require('./src/routes/user.routes'));
app.use('/api/analytics', require('./src/routes/analytics.routes'));

// Custom Error Interceptor Middleware
app.use(errorHandler);

// Start listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Certificate System Server is active on port: ${PORT}`);
  console.log(`Local URL: http://localhost:${PORT}`);
});
