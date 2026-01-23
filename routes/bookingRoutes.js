const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const authMiddleware = require('../middleware/auth');

// =============================================
// Multer setup for receipt image upload
// =============================================
const uploadDir = 'uploads/receipts';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG/PNG images allowed'));
  }
});

// =============================================
// GET /api/bookings/rooms/:id/availability
// =============================================
router.get('/rooms/:id/availability', async (req, res) => {
  console.log(`GET /api/bookings/rooms/${req.params.id}/availability - query:`, req.query);
  const { checkIn, checkOut } = req.query;

  if (!checkIn || !checkOut) {
    return res.status(400).json({ message: 'checkIn and checkOut dates are required' });
  }

  const start = new Date(checkIn);
  const end = new Date(checkOut);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ message: 'Invalid date range' });
  }

  try {
    console.log('Parsed dates:', { checkIn, checkOut });
    const overlapping = await Booking.find({
      room: req.params.id,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { checkIn: { $lt: end }, checkOut: { $gt: start } },
      ],
    }).select('_id checkIn checkOut status');

    const isAvailable = overlapping.length === 0;

    res.json({
      available: isAvailable,
      overlappingCount: overlapping.length,
      overlappingBookings: overlapping.map(b => ({
        id: b._id,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        status: b.status,
      })),
      message: isAvailable
        ? 'Room is available for the selected dates'
        : 'Room is already booked during this period',
    });
  } catch (err) {
    console.error('Availability check error:', err);
    res.status(500).json({ message: 'Server error while checking availability' });
  }
});

// =============================================
// POST /api/bookings - Create booking with receipt upload
// =============================================
router.post('/', authMiddleware, upload.single('receiptImage'), async (req, res) => {
  console.log('POST /api/bookings - incoming request');
  console.log('User:', req.user);
  console.log('Body:', req.body);
  console.log('File:', req.file ? req.file.filename : null);
  const { roomId, checkIn, checkOut, guests, notes, totalPrice } = req.body;
  const userId = req.user.id;

  // Validate required fields
  if (!roomId || !checkIn || !checkOut || !guests) {
    return res.status(400).json({ message: 'Missing required fields: roomId, checkIn, checkOut, guests' });
  }

  const start = new Date(checkIn);
  const end = new Date(checkOut);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ message: 'Invalid date range' });
  }

  if (guests < 1) {
    return res.status(400).json({ message: 'At least 1 guest required' });
  }

  try {
    // Check room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Double-check availability
    const overlapping = await Booking.find({
      room: roomId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [{ checkIn: { $lt: end }, checkOut: { $gt: start } }],
    });

    if (overlapping.length > 0) {
      return res.status(409).json({
        message: 'Room is no longer available for the selected dates',
        overlappingCount: overlapping.length,
      });
    }

    // Calculate total price (fallback to sent value or recalculate)
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const calculatedPrice = nights * room.price;
    const finalPrice = Number(totalPrice) || calculatedPrice;

    // Handle receipt image
    let receiptImage = null;
    if (req.file) {
      receiptImage = `/uploads/receipts/${req.file.filename}`;
    }

    // Create booking
    const booking = new Booking({
      user: userId,
      room: roomId,
      checkIn: start,
      checkOut: end,
      guests,
      notes: notes || '',
      totalPrice: finalPrice,
      receiptImage,
      status: 'pending',
    });

    await booking.save();

    // Populate for response
    await booking.populate('room', 'name price images');
    await booking.populate('user', 'name email');

    res.status(201).json({
      message: 'Booking request submitted successfully (pending approval)',
      bookingId: booking._id,
      booking: {
        id: booking._id,
        room: booking.room,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: booking.guests,
        totalPrice: booking.totalPrice,
        receiptImage: booking.receiptImage,
        status: booking.status,
        createdAt: booking.createdAt,
      },
    });
  } catch (err) {
    console.error('Booking creation error:', err);
    // If the pre-save overlapping check raised an error, surface it as 409
    if (err && err.message && err.message.toLowerCase().includes('booked')) {
      return res.status(409).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error while creating booking' });
  }
});

module.exports = router;