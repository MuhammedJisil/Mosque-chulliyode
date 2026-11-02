const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { requireMainAdmin } = require('../middleware/auth');

// Strict rate limiter for login to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Max 10 failed attempts per IP per 15 minutes
  skipSuccessfulRequests: true, // Do not penalize successful logins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed login attempts from this IP. Please wait 15 minutes before trying again.'
  }
});

// Strict rate limiter for password changes (anti-brute force / anti-tampering)
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6, // Max 6 password change requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password update attempts. Please wait 15 minutes before trying again.'
  }
});

// Admin Login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { username: username.trim() }
    });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid Admin username or password.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Admin username or password.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, name: admin.name, role: admin.role },
      process.env.JWT_SECRET || 'mosque_default_secret_key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
});

// Verify Current Token
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, username: true, name: true, role: true }
    });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/auth/admin-credentials - Update Admin ID (Username), Display Name, and/or Password
router.put('/admin-credentials', authMiddleware, requireMainAdmin, passwordLimiter, async (req, res) => {
  const { currentPassword, newUsername, newName, newPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ success: false, message: 'Current password is required to verify your identity before making administrative changes.' });
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id }
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password verification failed. Please enter your valid current password.' });
    }

    const updateData = {};

    // 1. Update Admin ID (Username)
    if (newUsername && newUsername.trim()) {
      const cleanUsername = newUsername.trim().toLowerCase();
      if (cleanUsername.length < 3) {
        return res.status(400).json({ success: false, message: 'Admin ID must be at least 3 characters long.' });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return res.status(400).json({ success: false, message: 'Admin ID can only contain letters, numbers, hyphens, dots, and underscores.' });
      }

      // Check uniqueness if changing
      if (cleanUsername !== admin.username) {
        const existing = await prisma.admin.findUnique({
          where: { username: cleanUsername }
        });
        if (existing && existing.id !== admin.id) {
          return res.status(400).json({ success: false, message: `Admin ID "${cleanUsername}" is already in use. Please pick another unique ID.` });
        }
        updateData.username = cleanUsername;
      }
    }

    // 2. Update Display Name
    if (newName && newName.trim()) {
      updateData.name = newName.trim();
    }

    // 3. Update Password (if provided)
    if (newPassword && newPassword.trim()) {
      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters long for adequate security.'
        });
      }
      const hasLetter = /[a-zA-Z]/.test(newPassword);
      const hasNumberOrSymbol = /[\d\W]/.test(newPassword);
      if (!hasLetter || !hasNumberOrSymbol) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain a combination of letters and at least one number or special character.'
        });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password cannot be the same as your current password.'
        });
      }

      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: 'No changes provided to update.' });
    }

    const updatedAdmin = await prisma.admin.update({
      where: { id: admin.id },
      data: updateData,
      select: { id: true, username: true, name: true, role: true }
    });

    // Generate fresh JWT token with the new username and role
    const newToken = jwt.sign(
      { id: updatedAdmin.id, username: updatedAdmin.username, role: updatedAdmin.role },
      process.env.JWT_SECRET || 'mosque_default_secret_key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Admin ID & security credentials updated successfully!',
      admin: updatedAdmin,
      token: newToken
    });
  } catch (error) {
    console.error('Update admin credentials error:', error);
    res.status(500).json({ success: false, message: 'Server error updating admin credentials: ' + error.message });
  }
});

// Change Password (for logged-in admin with high security)
router.put('/change-password', authMiddleware, passwordLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
  }

  // Strong password requirements to protect against hackers
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long for adequate security.'
    });
  }

  // Check for mix of characters (letters and numbers/symbols)
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumberOrSymbol = /[\d\W]/.test(newPassword);
  if (!hasLetter || !hasNumberOrSymbol) {
    return res.status(400).json({
      success: false,
      message: 'Password must contain a combination of letters and at least one number or special character.'
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password cannot be the same as your current password.'
    });
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id }
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password verification failed. Please check and try again.' });
    }

    // High security work factor: 12 salt rounds
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.admin.update({
      where: { id: admin.id },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Administrator password updated securely!'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to update password due to server error.' });
  }
});

// GET /api/auth/viewer - Fetch Viewer (Read-Only) user details (Main Admin only)
router.get('/viewer', authMiddleware, requireMainAdmin, async (req, res) => {
  try {
    let viewer = await prisma.admin.findFirst({
      where: { role: 'viewer' },
      select: { id: true, username: true, name: true, role: true, createdAt: true }
    });

    if (!viewer) {
      const defaultHash = await bcrypt.hash('viewer123', 10);
      viewer = await prisma.admin.create({
        data: {
          username: 'viewer',
          password: defaultHash,
          name: 'Read-Only Viewer',
          role: 'viewer'
        },
        select: { id: true, username: true, name: true, role: true, createdAt: true }
      });
    }

    res.json({ success: true, viewer });
  } catch (error) {
    console.error('Fetch viewer error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch viewer user details.' });
  }
});

// PUT /api/auth/viewer - Update Viewer user credentials (username, name, password) (Main Admin only)
router.put('/viewer', authMiddleware, requireMainAdmin, async (req, res) => {
  const { username, name, password } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
    return res.status(400).json({
      success: false,
      message: 'Username must be 3-30 characters long and contain only lowercase letters, numbers, or underscores.'
    });
  }

  try {
    let viewer = await prisma.admin.findFirst({
      where: { role: 'viewer' }
    });

    if (!viewer) {
      const defaultHash = await bcrypt.hash('viewer123', 10);
      viewer = await prisma.admin.create({
        data: {
          username: 'viewer',
          password: defaultHash,
          name: 'Read-Only Viewer',
          role: 'viewer'
        }
      });
    }

    // Ensure username is not taken by another user
    const existing = await prisma.admin.findFirst({
      where: {
        username: cleanUsername,
        NOT: { id: viewer.id }
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Username "${cleanUsername}" is already taken by another account.`
      });
    }

    const updateData = {
      username: cleanUsername,
      name: name ? name.trim() : (viewer.name || 'Read-Only Viewer')
    };

    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Viewer password must be at least 6 characters long.'
        });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.admin.update({
      where: { id: viewer.id },
      data: updateData,
      select: { id: true, username: true, name: true, role: true, createdAt: true }
    });

    res.json({
      success: true,
      message: 'Viewer user credentials updated successfully!',
      viewer: updated
    });
  } catch (error) {
    console.error('Update viewer error:', error);
    res.status(500).json({ success: false, message: 'Failed to update viewer user credentials.' });
  }
});

module.exports = router;
