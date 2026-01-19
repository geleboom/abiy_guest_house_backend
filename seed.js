require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('./models/Room');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to DB for seeding');

    // Clear existing
    await Room.deleteMany({});

    // Add 22 sample rooms (adjust prices/descriptions with real data later)
    const rooms = [
      ...Array.from({ length: 12 }, (_, i) => ({
        name: `Standard Room ${101 + i}`,
        type: 'Standard',
        pricePerNight: 1500,
        maxGuests: 2,
        description: 'Comfortable room with twin beds, WiFi, and private bathroom.',
        amenities: ['WiFi', 'Breakfast', 'Parking', 'Fan'],
        roomNumber: `${101 + i}`,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `Deluxe Room ${201 + i}`,
        type: 'Deluxe',
        pricePerNight: 2500,
        maxGuests: 2,
        description: 'Spacious deluxe with king bed, AC, lake-area view, hot shower.',
        amenities: ['WiFi', 'Breakfast', 'AC', 'Hot Water', 'TV'],
        roomNumber: `${201 + i}`,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        name: `Family Suite ${301 + i}`,
        type: 'Family',
        pricePerNight: 3500,
        maxGuests: 4,
        description: 'Large suite for families, 2 bedrooms, extra beds available.',
        amenities: ['WiFi', 'Breakfast', 'AC', 'Hot Water', 'Extra Bed'],
        roomNumber: `${301 + i}`,
      })),
    ];

    await Room.insertMany(rooms);
    console.log('Seeded 22 rooms successfully!');

    mongoose.connection.close();
  })
  .catch(err => console.error('Seeding error:', err));