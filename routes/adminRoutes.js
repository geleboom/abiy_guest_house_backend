// GET /api/bookings/pending/count
router.get('/pending/count', authMiddleware, async (req, res) => {
  try {
    const count = await Booking.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});