import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { SpatialCell } from './src/models/SpatialCell.js';

dotenv.config();

async function createHighRiskCells() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    await SpatialCell.deleteMany({});
    console.log('Cleared existing cells');

    const highRiskCells = [
      { h3Index: '88608b0b13fffff', compositeRisk: 8.5, scores: { mobility: 9.0, climate: 8.5, vulnerability: 7.5 }, riskLevel: 'CRITICAL', latitude: 19.07, longitude: 72.87 },
      { h3Index: '88608b0b61fffff', compositeRisk: 7.8, scores: { mobility: 8.2, climate: 7.5, vulnerability: 7.0 }, riskLevel: 'CRITICAL', latitude: 19.08, longitude: 72.88 },
      { h3Index: '88608b0b23fffff', compositeRisk: 7.2, scores: { mobility: 7.5, climate: 7.0, vulnerability: 6.5 }, riskLevel: 'CRITICAL', latitude: 19.05, longitude: 72.85 },
      { h3Index: '88608b0b31fffff', compositeRisk: 6.5, scores: { mobility: 7.0, climate: 6.5, vulnerability: 5.5 }, riskLevel: 'HIGH', latitude: 19.10, longitude: 72.90 },
      { h3Index: '88608b0b41fffff', compositeRisk: 5.8, scores: { mobility: 6.5, climate: 6.0, vulnerability: 4.5 }, riskLevel: 'HIGH', latitude: 19.12, longitude: 72.86 },
      { h3Index: '88608b0b51fffff', compositeRisk: 4.5, scores: { mobility: 5.0, climate: 5.0, vulnerability: 3.5 }, riskLevel: 'MODERATE', latitude: 19.03, longitude: 72.83 },
      { h3Index: '88608b0b71fffff', compositeRisk: 3.2, scores: { mobility: 3.5, climate: 3.0, vulnerability: 2.5 }, riskLevel: 'MODERATE', latitude: 19.15, longitude: 72.92 },
      { h3Index: '88608b0b81fffff', compositeRisk: 2.1, scores: { mobility: 2.5, climate: 2.0, vulnerability: 1.5 }, riskLevel: 'LOW', latitude: 19.00, longitude: 72.80 },
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

    console.log(`Created ${highRiskCells.length} high-risk cells`);
    console.log('\nCells created:');
    highRiskCells.forEach(cell => {
      console.log(`- ${cell.h3Index}: Risk ${cell.compositeRisk} (${cell.riskLevel})`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createHighRiskCells();
