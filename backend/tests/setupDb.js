/**
 * Database Setup
 * Maintainability Principle: Testing Strategy
 *
 * Only the tests that touch the database load this. The unit tests run
 * without a database, so a missing MongoDB does not hide a broken unit.
 */

import mongoose from 'mongoose';

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
