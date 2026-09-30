import mongoose from 'mongoose';
import { SpatialCell } from './src/models/SpatialCell.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkCells() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    const now = Date.now();
    const cutoff = new Date(now - 24 * 60 * 60 * 1000);
    
    console.log('Current time:', new Date(now).toISOString());
    console.log('24-hour cutoff:', cutoff.toISOString());

    const totalCells = await SpatialCell.countDocuments();
    const recentCells = await SpatialCell.countDocuments({ lastUpdated: { $gte: cutoff } });
    
    console.log('Total cells in database:', totalCells);
    console.log('Cells within last 24 hours:', recentCells);

    // Show a few sample cells
    const sampleCells = await SpatialCell.find().limit(5).lean();
    console.log('\nSample cells:');
    sampleCells.forEach(cell => {
      console.log(`H3: ${cell.h3Index}, Last Updated: ${cell.lastUpdated}, Risk: ${cell.compositeRisk}`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCells();
