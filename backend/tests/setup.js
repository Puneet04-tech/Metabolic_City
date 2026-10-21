/**
 * Test Setup
 * Maintainability Principle: Testing Strategy
 */

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/metabolic_city_test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
