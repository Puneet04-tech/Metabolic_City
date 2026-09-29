import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { TokenSession } from '../models/TokenSession.js';

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

// Server-side token revocation store (in-memory). Replace with Redis for multi-instance deployments.
const revokedTokens = new Set();

export function revokeToken(token) {
  if (token) revokedTokens.add(token);
}

export function isTokenRevoked(token) {
  return revokedTokens.has(token);
}

// Restrict a route to a set of roles.
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const userRole = req.user.role;
  // Accept both canonical role names and friendly aliases
  const allowed = roles.some(
    (role) =>
      role === userRole ||
      (role === 'field' && userRole === 'field_crew') ||
      (role === 'admin' && userRole === 'administrator') ||
      (role === 'field_crew' && userRole === 'field') ||
      (role === 'administrator' && userRole === 'admin')
  );

  if (!allowed) {
    return res.status(403).json({ message: 'Forbidden: your role does not have permission to access this resource.' });
  }
  next();
};

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
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid or expired token.' });
    }

    if (isTokenRevoked(token) || !decoded.jti || decoded.type !== 'access') {
      return res.status(401).json({ message: 'Unauthorized: Token has been revoked.' });
    }

    const session = await TokenSession.findOne({ jti: decoded.jti, revokedAt: null });
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized: Token has been revoked or session expired.' });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.active === false) {
      return res.status(401).json({ message: 'Unauthorized: User account not found or deactivated.' });
    }

    delete user.password;
    req.user = user;
    req.token = token;
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token.' });
  }
};