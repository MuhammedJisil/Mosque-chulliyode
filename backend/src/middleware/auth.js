const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mosque_default_secret_key');
    req.admin = decoded;

    // View-only account restriction:
    // If the signed-in user has role 'viewer', block all mutating HTTP methods (POST, PUT, DELETE, PATCH)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      if (req.admin.role === 'viewer') {
        return res.status(403).json({
          success: false,
          message: 'Read-Only Account: You are signed in with viewing & searching permissions only. Creating, editing, or deleting records is restricted to the Main Admin.'
        });
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
  }
};

const requireMainAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only the Main Administrator has permission to perform this action.'
    });
  }
  next();
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requireMainAdmin = requireMainAdmin;
