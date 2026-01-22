const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// GET all rooms (public)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ type: 1, name: 1 });
    res.json(rooms);
  } catch (err) {
    console.error('GET /rooms error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single room (public)
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    console.error('GET /rooms/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new room - ADMIN ONLY
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, price, maxGuests, description, type } = req.body;

  if (!name || price == null || !maxGuests) {
    return res.status(400).json({ message: 'Name, price, maxGuests required' });
  }

  try {
    const room = new Room({
      name,
      price: Number(price),
      maxGuests: Number(maxGuests),
      description: description || '',
      type: type || 'standard',
    });
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    console.error('POST /rooms error:', err);
    res.status(400).json({ message: err.message });
  }
});

// PUT update room - ADMIN ONLY
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $set: req.body }, // only update sent fields
      { new: true, runValidators: true }
    );

    if (!room) return res.status(404).json({ message: 'Room not found' });

    res.json(room);
  } catch (err) {
    console.error('PUT /rooms/:id error:', err);
    res.status(400).json({ message: err.message || 'Update failed' });
  }
});

// DELETE room - ADMIN ONLY
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error('DELETE /rooms/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;