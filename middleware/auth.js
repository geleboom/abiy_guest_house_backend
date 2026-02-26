const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Get token from header (Authorization: Bearer <token>)
  const authHeader = req.header('Authorization');

  // More robust check
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth middleware: No Bearer token provided'); // log for debug
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Extract token
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    console.log('Auth middleware: Empty token after Bearer');
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Optional: log decoded payload (for debugging only - remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Auth middleware: Token verified. User:', decoded.id);
    }

    // Attach decoded user to request
    req.user = decoded; // { id: user._id, email?, phoneNumber?, role?, ... }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }

    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = authMiddleware;