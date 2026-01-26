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
// GET /api/bookings/my - return bookings for authenticated user
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const bookings = await Booking.find({ user: userId })
      .populate('room', 'name pricePerNight images')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    // Normalize dates to ISO strings for the client
    const result = bookings.map(b => ({
      id: b._id,
      room: b.room,
      checkIn: b.checkIn?.toISOString(),
      checkOut: b.checkOut?.toISOString(),
      guests: b.guests,
      totalPrice: b.totalPrice,
      receiptImage: b.receiptImage,
      status: b.status,
      createdAt: b.createdAt?.toISOString(),
    }));

    res.json(result);
  } catch (err) {
    console.error('Fetch my bookings error:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    res.status(500).json({ message: 'Server error while fetching bookings', detail: err.message || String(err) });
  }
});

router.post('/', authMiddleware, upload.single('receiptImage'), async (req, res) => {
  const { roomId, checkIn, checkOut, guests, notes, totalPrice } = req.body;
  const userId = req.user && req.user.id;

  // Ensure auth middleware provided a valid user
  if (!userId) {
    console.error('Booking attempt without authenticated user:', { body: req.body, headers: req.headers });
    return res.status(401).json({ message: 'Unauthorized - missing user' });
  }

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
    // Room model uses `pricePerNight`
    const calculatedPrice = nights * (room.pricePerNight || room.price || 0);
    const parsedTotal = Number(totalPrice);
    const finalPrice = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : calculatedPrice;

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

    console.log('Saving booking:', {
      user: userId,
      room: roomId,
      checkIn: start,
      checkOut: end,
      guests,
      totalPrice: finalPrice,
      receiptImage,
    });

    try {
      await booking.save();
    } catch (saveErr) {
      console.error('Error saving booking:', saveErr && saveErr.message ? saveErr.message : saveErr);
      if (saveErr && typeof saveErr.message === 'string' && saveErr.message.includes('already booked')) {
        return res.status(409).json({ message: 'Room is already booked for these dates' });
      }
      throw saveErr;
    }

    // Populate for response (match Room schema)
    await booking.populate('room', 'name pricePerNight images');
    await booking.populate('user', 'name email');

    res.status(201).json({
      message: 'Booking request submitted successfully (pending approval)',
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
    // Log detailed server-side error for debugging
    console.error('Booking creation error:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);

    // If this is a mongoose validation error, return 400 with details
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: err.errors });
    }

    res.status(500).json({ message: 'Server error while creating booking', detail: err.message || String(err) });
  }
});
// =============================================
// GET /pending        → becomes /api/bookings/pending
// =============================================
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ status: 'pending' })
      .populate('room', 'name pricePerNight images')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = bookings.map(b => ({
      _id: b._id.toString(),
      room: b.room,
      user: b.user,
      checkIn: b.checkIn?.toISOString(),
      checkOut: b.checkOut?.toISOString(),
      guests: b.guests,
      totalPrice: b.totalPrice,
      receiptImage: b.receiptImage,
      status: b.status,
      createdAt: b.createdAt?.toISOString(),
      notes: b.notes || '',
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Pending bookings error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =============================================
// GET /pending/count  → /api/bookings/pending/count
// =============================================
router.get('/pending/count', authMiddleware, async (req, res) => {
  try {
    const count = await Booking.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});router.put('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    console.log(`Approving booking ${req.params.id} - current status: ${booking.status}`);

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: `Cannot approve booking with status: ${booking.status}` });
    }

    booking.status = 'confirmed'; // or 'approved' – make sure this matches what user app expects
    await booking.save();

    console.log(`Booking ${req.params.id} updated to status: ${booking.status}`);

    res.json({
      message: 'Booking approved successfully',
      booking: {
        _id: booking._id,
        status: booking.status,
      }
    });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// GET /confirmed
router.get('/confirmed', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ status: 'confirmed' })
      .populate('room', 'name pricePerNight images')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = bookings.map(b => ({
      _id: b._id.toString(),
      room: b.room,
      user: b.user,
      checkIn: b.checkIn?.toISOString(),
      checkOut: b.checkOut?.toISOString(),
      guests: b.guests,
      totalPrice: b.totalPrice,
      receiptImage: b.receiptImage,
      status: b.status,
      createdAt: b.createdAt?.toISOString(),
      notes: b.notes || '',
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /rejected
router.get('/rejected', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ status: 'rejected' })
      .populate('room', 'name pricePerNight images')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = bookings.map(b => ({
      _id: b._id.toString(),
      // ... same formatting as above
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET / (all bookings) - optional but useful for "All" tab
router.get('/', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('room', 'name pricePerNight images')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = bookings.map(b => ({
      _id: b._id.toString(),
      // ... same formatting
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
