const jwt = require('jsonwebtoken');

const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ status: 'error', message: 'Access denied' });
      }
      next();
    } catch (error) {
      res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
  };
};

module.exports = authMiddleware;