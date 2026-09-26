import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User.js';
import { TokenSession } from '../models/TokenSession.js';
import { protect, authorize, revokeToken, getJwtSecret } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

const ROLES = ['operator', 'field_crew', 'administrator'];

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

const roleAliases = {
  field: 'field_crew',
  field_crew: 'field_crew',
  admin: 'administrator',
  administrator: 'administrator',
  operator: 'operator',
};

const toPlanRole = (role) => (role === 'field_crew' ? 'field' : role === 'administrator' ? 'admin' : role);

const createToken = (user, type, expiresIn) => {
  const tokenId = crypto.randomUUID();
  const payload = {
    sub: user._id.toString(),
    id: user._id.toString(),
    role: toPlanRole(user.role),
    jurisdiction: user.jurisdiction || user.cityCode,
    type,
    jti: tokenId,
  };
  return { token: jwt.sign(payload, getJwtSecret(), { expiresIn }), tokenId };
};

const persistSession = async (user, tokenId, expiresAt) => {
  await TokenSession.create({ jti: tokenId, userId: user._id, expiresAt });
};

const setRefreshCookie = (res, token) => {
  const serialized = `metabolic_city_refresh=${encodeURIComponent(token)}; Max-Age=604800; Path=/api/auth; HttpOnly; SameSite=Strict${
    process.env.NODE_ENV === 'production' ? '; Secure' : ''
  }`;
  res.setHeader('Set-Cookie', serialized);
};

const clearRefreshCookie = (res) => {
  res.setHeader(
    'Set-Cookie',
    'metabolic_city_refresh=; Max-Age=0; Path=/api/auth; HttpOnly; SameSite=Strict' +
      (process.env.NODE_ENV === 'production' ? '; Secure' : '')
  );
};

const readRefreshCookie = (req) => {
  const cookies = (req.headers.cookie || '').split(';').map((part) => part.trim());
  const value = cookies.find((part) => part.startsWith('metabolic_city_refresh='));
  return value ? decodeURIComponent(value.slice('metabolic_city_refresh='.length)) : null;
};

const issueSession = async (res, user) => {
  const access = createToken(user, 'access', ACCESS_TOKEN_TTL);
  const refresh = createToken(user, 'refresh', REFRESH_TOKEN_TTL);
  await persistSession(user, access.tokenId, new Date(Date.now() + 15 * 60 * 1000));
  await persistSession(user, refresh.tokenId, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  setRefreshCookie(res, refresh.token);
  return access.token;
};

// Login / signup brute-force protection (stricter than the global limit).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

const normalizeRole = (role) => roleAliases[(role || '').toString().trim().toLowerCase()] || '';

const validateBody = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ message: errors.array()[0].msg });
  }
  return null;
};

const validateSignup = (role, payload) => {
  const errors = [];
  if (role === 'operator' && !payload.staffId) errors.push('Operator Console ID is required.');
  if (role === 'field_crew' && !payload.phone) errors.push('Registered mobile number is required.');
  if (role === 'administrator' && !payload.adminId) errors.push('Administrator account ID is required.');
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
  jurisdiction: user.jurisdiction || user.cityCode,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// Shared field validators (run for signup/login).
const commonValidators = [
  body('cityCode').trim().escape().notEmpty().withMessage('Municipality / City Code is required.')
    .isLength({ min: 2, max: 50 }).withMessage('Invalid city code.'),
  body('role').custom((role) => ROLES.includes(normalizeRole(role)))
    .withMessage('Invalid role selected.'),
  body('password').isLength({ min: 8, max: 72 }).withMessage('Password must be between 8 and 72 characters.')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter.')
    .matches(/\d/).withMessage('Password must contain at least one number.'),
];

const signupValidators = [
  ...commonValidators,
  body('name').trim().escape().notEmpty().withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.'),
  body('email').trim().normalizeEmail().isEmail().withMessage('A valid email is required.')
    .isLength({ max: 160 }).withMessage('Email is too long.'),
];

router.post('/signup', authLimiter, signupValidators, async (req, res) => {
  const badRequest = validateBody(req, res);
  if (badRequest) return;

  try {
    const role = normalizeRole(req.body.role);
    const validationErrors = validateSignup(role, req.body);
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

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      cityCode: req.body.cityCode,
      jurisdiction: req.body.jurisdiction || req.body.cityCode,
      role,
      staffId: role === 'operator' ? req.body.staffId : undefined,
      phone: role === 'field_crew' ? req.body.phone : undefined,
      adminId: role === 'administrator' ? req.body.adminId : undefined,
      organization: req.body.organization || 'Metabolic City',
    });

    const token = await issueSession(res, user);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with these credentials already exists.' });
    }
    return res.status(500).json({ message: 'Signup failed. Please try again.' });
  }
});

router.post('/login', authLimiter, commonValidators, async (req, res) => {
  const badRequest = validateBody(req, res);
  if (badRequest) return;

  try {
    const role = normalizeRole(req.body.role);
    const cityCode = (req.body.cityCode || '').trim();

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
    if (!user.password) {
      return res.status(401).json({ message: 'Invalid credentials for the selected role.' });
    }

    const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Incorrect password or access token.' });
    }

    const token = await issueSession(res, user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) return res.status(401).json({ message: 'Refresh session is required.' });

  try {
    const decoded = jwt.verify(refreshToken, getJwtSecret());
    if (decoded.type !== 'refresh' || !decoded.jti) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Invalid refresh session.' });
    }

    const session = await TokenSession.findOne({ jti: decoded.jti, revokedAt: null });
    if (!session) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Refresh session has been revoked.' });
    }

    await TokenSession.updateOne({ jti: decoded.jti }, { $set: { revokedAt: new Date() } });
    const user = await User.findById(decoded.sub);
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'User not found.' });
    }

    const token = await issueSession(res, user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Invalid or expired refresh session.' });
  }
});

router.get('/me', protect, async (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

router.post('/logout', protect, async (req, res) => {
  await TokenSession.updateOne({ jti: req.auth.jti }, { $set: { revokedAt: new Date() } });
  const refreshToken = readRefreshCookie(req);
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, getJwtSecret());
      if (decoded.jti) await TokenSession.updateOne({ jti: decoded.jti }, { $set: { revokedAt: new Date() } });
    } catch {
      // The access session is still revoked even when the refresh cookie is stale.
    }
  }
  revokeToken(req.token);
  clearRefreshCookie(res);
  return res.status(204).end();
});

// Example role-guarded endpoint (administrator only) to demonstrate authorization.
router.get('/admin/status', protect, authorize('administrator'), async (req, res) => {
  return res.json({ status: 'ok', role: req.user.role, admin: true });
});

export default router;
