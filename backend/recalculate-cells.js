import mongoose from 'mongoose';
import { recalculateAllActiveCells } from './src/engine/risk.js';
import dotenv from 'dotenv';

dotenv.config();

async function recalculateCells() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    console.log('Starting spatial cell recalculation...');
    const results = await recalculateAllActiveCells();
    console.log(`Recalculated ${results.length} spatial cells`);

    console.log('Cell recalculation complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error recalculating cells:', error);
    process.exit(1);
  }
}

recalculateCells();
