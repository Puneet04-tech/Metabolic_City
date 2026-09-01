import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const createToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const normalizeRole = (role) => (role || '').toString().trim().toLowerCase();

const validateSignup = (role, payload) => {
  const errors = [];

  if (!payload.name) errors.push('Full name is required.');
  if (!payload.email) errors.push('Email is required.');
  if (!payload.password) errors.push('Password is required.');
  if (!payload.cityCode) errors.push('Municipality / City Code is required.');

  if (role === 'operator') {
    if (!payload.staffId) errors.push('Operator Console ID is required.');
  }

  if (role === 'field_crew') {
    if (!payload.phone) errors.push('Registered mobile number is required.');
  }

  if (role === 'administrator') {
    if (!payload.adminId) errors.push('Administrator account ID is required.');
  }

  return errors;
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  cityCode: user.cityCode,
  role: user.role,
  staffId: user.staffId,
  phone: user.phone,
  adminId: user.adminId,
  organization: user.organization,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

router.post('/signup', async (req, res) => {
  try {
    const role = normalizeRole(req.body.role);
    const validationErrors = validateSignup(role, req.body);

    if (!role || !['operator', 'field_crew', 'administrator'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role selected.' });
    }

    if (validationErrors.length) {
      return res.status(400).json({ message: validationErrors[0] });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: req.body.email },
        ...(role === 'operator' && req.body.staffId ? [{ cityCode: req.body.cityCode, role, staffId: req.body.staffId }] : []),
        ...(role === 'field_crew' && req.body.phone ? [{ cityCode: req.body.cityCode, role, phone: req.body.phone }] : []),
        ...(role === 'administrator' && req.body.adminId ? [{ cityCode: req.body.cityCode, role, adminId: req.body.adminId }] : []),
      ],
    });

    if (existingUser) {
      return res.status(409).json({ message: 'An account with these credentials already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      cityCode: req.body.cityCode,
      role,
      staffId: role === 'operator' ? req.body.staffId : undefined,
      phone: role === 'field_crew' ? req.body.phone : undefined,
      adminId: role === 'administrator' ? req.body.adminId : undefined,
      organization: req.body.organization || 'Metabolic City',
    });

    const token = createToken(user);
    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with these credentials already exists.' });
    }
    return res.status(500).json({ message: 'Signup failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const role = normalizeRole(req.body.role);
    const cityCode = (req.body.cityCode || '').trim();

    if (!role || !['operator', 'field_crew', 'administrator'].includes(role)) {
      return res.status(400).json({ message: 'Please select a valid role.' });
    }

    if (!cityCode) {
      return res.status(400).json({ message: 'City code is required.' });
    }

    let query = { cityCode, role };
    if (role === 'operator') {
      query.staffId = req.body.staffId;
    } else if (role === 'field_crew') {
      query.phone = req.body.phone;
    } else if (role === 'administrator') {
      query.adminId = req.body.adminId;
    }

    const userRecord = await User.findOne(query);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid credentials for the selected role.' });
    }

    const user = userRecord.select ? userRecord.select('+password') : { ...userRecord };

    const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Incorrect password or access token.' });
    }

    const token = createToken(user);
    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

router.get('/me', protect, async (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

export default router;
