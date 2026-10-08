/**
 * Test Setup
 * Maintainability Principle: Testing Strategy
 */

import mongoose from 'mongoose';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/metabolic_city_test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';

// Connect to test database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

// Clean up database after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Close database connection after all tests
afterAll(async () => {
  await mongoose.connection.close();
});
