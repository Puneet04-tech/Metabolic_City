import mongoose from 'mongoose';
import { TelemetryEvent } from './src/models/TelemetryEvent.js';
import { SpatialCell } from './src/models/SpatialCell.js';
import { recalculateCell } from './src/engine/risk.js';
import dotenv from 'dotenv';

dotenv.config();

async function processTelemetryToCells() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    // Get all unique H3 indices from telemetry events
    const uniqueH3Indices = await TelemetryEvent.distinct('h3Index');
    console.log(`Found ${uniqueH3Indices.length} unique H3 indices in telemetry data`);

    // Clear existing spatial cells
    await SpatialCell.deleteMany({});
    console.log('Cleared existing spatial cells');

    // Recalculate cells for each unique H3 index
    let processed = 0;
    for (const h3Index of uniqueH3Indices) {
      try {
        await recalculateCell(h3Index);
        processed++;
        if (processed % 10 === 0) {
          console.log(`Processed ${processed}/${uniqueH3Indices.length} cells`);
        }
      } catch (error) {
        console.error(`Failed to process cell ${h3Index}:`, error.message);
      }
    }

    console.log(`Successfully processed ${processed} spatial cells`);
    console.log('Telemetry to cell processing complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error processing telemetry to cells:', error);
    process.exit(1);
  }
}

processTelemetryToCells();
