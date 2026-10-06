import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { SpatialCell } from './src/models/SpatialCell.js';
import h3 from 'h3-js';

dotenv.config();

async function createHighRiskCells() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    await SpatialCell.deleteMany({});
    console.log('Cleared existing cells');

    // Generate H3 indices for India coordinates
    const highRiskCells = [
      // Bhopal cells
      { h3Index: h3.latLngToCell(23.2599, 77.4126, 8), compositeRisk: 8.5, scores: { mobility: 9.0, climate: 8.5, vulnerability: 7.5 }, riskLevel: 'CRITICAL', latitude: 23.2599, longitude: 77.4126 },
      { h3Index: h3.latLngToCell(23.2500, 77.4200, 8), compositeRisk: 7.8, scores: { mobility: 8.2, climate: 7.5, vulnerability: 7.0 }, riskLevel: 'CRITICAL', latitude: 23.2500, longitude: 77.4200 },
      { h3Index: h3.latLngToCell(23.2700, 77.4000, 8), compositeRisk: 7.2, scores: { mobility: 7.5, climate: 7.0, vulnerability: 6.5 }, riskLevel: 'CRITICAL', latitude: 23.2700, longitude: 77.4000 },
      // Indore cells
      { h3Index: h3.latLngToCell(22.7196, 75.8577, 8), compositeRisk: 6.5, scores: { mobility: 7.0, climate: 6.5, vulnerability: 5.5 }, riskLevel: 'HIGH', latitude: 22.7196, longitude: 75.8577 },
      { h3Index: h3.latLngToCell(22.7300, 75.8700, 8), compositeRisk: 5.8, scores: { mobility: 6.5, climate: 6.0, vulnerability: 4.5 }, riskLevel: 'HIGH', latitude: 22.7300, longitude: 75.8700 },
      { h3Index: h3.latLngToCell(22.7100, 75.8400, 8), compositeRisk: 4.5, scores: { mobility: 5.0, climate: 5.0, vulnerability: 3.5 }, riskLevel: 'MODERATE', latitude: 22.7100, longitude: 75.8400 },
      // Sehore cells
      { h3Index: h3.latLngToCell(23.2080, 77.0816, 8), compositeRisk: 3.2, scores: { mobility: 3.5, climate: 3.0, vulnerability: 2.5 }, riskLevel: 'MODERATE', latitude: 23.2080, longitude: 77.0816 },
      { h3Index: h3.latLngToCell(23.2200, 77.0900, 8), compositeRisk: 2.1, scores: { mobility: 2.5, climate: 2.0, vulnerability: 1.5 }, riskLevel: 'LOW', latitude: 23.2200, longitude: 77.0900 },
    ];

    for (const cellData of highRiskCells) {
      await SpatialCell.create({
        ...cellData,
        history: [{
          compositeRisk: cellData.compositeRisk,
          scores: cellData.scores,
          calculatedAt: new Date(),
        }],
        telemetryStats: {
          eventCount: 10,
          sources: ['WEATHER_API', 'GTFS_TRANSIT'],
          lastObservedAt: new Date(),
        },
      });
    }

    console.log(`Created ${highRiskCells.length} high-risk cells in India (Bhopal, Indore, Sehore)`);
    console.log('\nCells created:');
    highRiskCells.forEach(cell => {
      console.log(`- ${cell.h3Index}: Risk ${cell.compositeRisk} (${cell.riskLevel}) at [${cell.latitude}, ${cell.longitude}]`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createHighRiskCells();
