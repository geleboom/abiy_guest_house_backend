require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authRoutes = require('./routes/authRoutes');
const app = express();
const adminRoutes = require('./auth/admin-login');
const userRoutes = require('./routes/userRoutes');

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use(cors());                // Allow cross-origin (Flutter app)
app.use(express.json());        // Parse JSON bodies FIRST
// Serve uploaded files (receipts) so clients can access returned paths
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(morgan('dev'));         // Logging

// Routes - AFTER middleware
app.use('/api/auth', authRoutes);     // Login/register
app.use('/api/rooms', roomRoutes);
app.use('/api', bookingRoutes);       // bookings under /api (or change to /api/bookings)

// Test route (for debugging)
app.get('/api/test', (req, res) => {
  res.send('Backend is alive and routes are mounted!');
});

// Root test
app.get('/', (req, res) => res.send('Abiy Guest House API is live!'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Optional: stop server if DB fails
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});