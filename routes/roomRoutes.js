const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin'); // ← add if missing (see below)

// GET all rooms - public (for user app & admin list)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ type: 1, name: 1 });
    res.json(rooms);
  } catch (err) {
    console.error('GET /rooms error:', err);
    res.status(500).json({ message: 'Server error fetching rooms' });
  }
});

// GET single room - public
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

  // Basic validation
  if (!name || !price || !maxGuests) {
    return res.status(400).json({ message: 'Name, price, and maxGuests are required' });
  }

  if (price <= 0 || maxGuests < 1) {
    return res.status(400).json({ message: 'Price and maxGuests must be positive' });
  }

  try {
    const room = new Room({
      name,
      price: Number(price),
      maxGuests: Number(maxGuests),
      description: description || '',
      type: type || 'standard', // optional field
    });

    await room.save();
    res.status(201).json(room);
  } catch (err) {
    console.error('POST /rooms error:', err);
    res.status(400).json({ message: err.message || 'Failed to add room' });
  }
});

// PUT update room - ADMIN ONLY
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, price, maxGuests, description, type } = req.body;

  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Update only provided fields
    if (name !== undefined) room.name = name;
    if (price !== undefined) room.price = Number(price);
    if (maxGuests !== undefined) room.maxGuests = Number(maxGuests);
    if (description !== undefined) room.description = description;
    if (type !== undefined) room.type = type;

    await room.save();
    res.json(room);
  } catch (err) {
    console.error('PUT /rooms/:id error:', err);
    res.status(400).json({ message: err.message || 'Failed to update room' });
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
    res.status(500).json({ message: 'Server error deleting room' });
  }
});

module.exports = router;