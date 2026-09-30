import mongoose from 'mongoose';
import { SpatialCell } from './src/models/SpatialCell.js';
import dotenv from 'dotenv';

dotenv.config();

async function testCellsAPI() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    const now = Date.now();
    const cutoff = new Date(now - 24 * 60 * 60 * 1000);
    
    console.log('Current time:', new Date(now).toISOString());
    console.log('24-hour cutoff:', cutoff.toISOString());

    const cells = await SpatialCell.find({ lastUpdated: { $gte: cutoff } })
      .sort({ compositeRisk: -1 })
      .limit(250)
      .lean();
    
    console.log('Active cells found:', cells.length);
    console.log('API Response:', JSON.stringify({ count: cells.length, cells: cells.slice(0, 3) }, null, 2));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testCellsAPI();
