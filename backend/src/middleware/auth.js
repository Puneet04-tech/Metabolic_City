import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

let secret;
export function getJwtSecret() {
  if (secret) return secret;
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32 || value === 'metabolic-city-super-secret-key') {
    throw new Error(
      '[auth] JWT_SECRET must be set to a strong random value of at least 32 characters. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  secret = value;
  return secret;
}

// Server-side token revocation store (in-memory). Replace with Redis for multi-instance.
const revokedTokens = new Set();

export function revokeToken(token) {
  if (token) revokedTokens.add(token);
}

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Missing bearer token.' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      return res.status(401).json({ message: 'Unauthorized: Invalid or expired token.' });
    }

    if (revokedTokens.has(token)) {
      return res.status(401).json({ message: 'Unauthorized: Token has been revoked.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found.' });
    }

    delete user.password;
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token.' });
  }
};

// Restrict a route to a set of roles.
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient permissions.' });
  }
  next();
};
