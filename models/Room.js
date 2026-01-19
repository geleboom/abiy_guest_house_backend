const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },           // e.g. "Standard Room 101"
  type: { type: String, enum: ['Standard', 'Deluxe', 'Family'], required: true },
  pricePerNight: { type: Number, required: true },  // in ETB
  maxGuests: { type: Number, default: 2 },
  description: { type: String },
  images: [{ type: String }],                       // URLs or asset paths later
  amenities: [{ type: String }],                    // e.g. ['WiFi', 'Breakfast', 'Parking']
  roomNumber: String,
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);