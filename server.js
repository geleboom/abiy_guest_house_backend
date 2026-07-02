require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// ── Global middleware (must come BEFORE all routes) ──
app.use(cors());                // Allow cross-origin (Flutter app)
app.use(express.json());        // Parse JSON bodies
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files
app.use(morgan('dev'));         // Logging

// ── Routes ──
app.use('/api/auth', authRoutes);         // Login/register (includes admin-login)
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);

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