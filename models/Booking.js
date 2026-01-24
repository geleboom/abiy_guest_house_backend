const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, required: true, min: 1 },
  notes: { type: String },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending',
  },
  totalPrice: { type: Number },
  receiptImage: {
    type: String,
    default: null
  },
  createdAt: { type: Date, default: Date.now },
});

// Prevent overlapping bookings on save (optional but recommended)
bookingSchema.pre('save', async function () {
  const overlapping = await mongoose.model('Booking').find({
    room: this.room,
    status: { $in: ['pending', 'confirmed'] },
    _id: { $ne: this._id },
    $or: [
      { checkIn: { $lt: this.checkOut }, checkOut: { $gt: this.checkIn } },
    ],
  });

  if (overlapping.length > 0) {
    throw new Error('Room is already booked for these dates');
  }
});

module.exports = mongoose.model('Booking', bookingSchema);