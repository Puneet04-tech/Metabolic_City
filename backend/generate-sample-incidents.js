import mongoose from 'mongoose';
import { Incident } from './src/models/Incident.js';
import { SpatialCell } from './src/models/SpatialCell.js';
import { User } from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function generateSampleIncidents() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    // Get the operator user
    const UserModel = mongoose.model('User');
    const operator = await UserModel.findOne({ role: 'operator' });
    if (!operator) {
      console.log('No operator user found. Please create an operator first.');
      process.exit(1);
    }

    // Get some spatial cells
    const cells = await SpatialCell.find({}).limit(10).lean();
    if (cells.length === 0) {
      console.log('No spatial cells found. Please generate spatial cells first.');
      process.exit(1);
    }

    // Clear existing incidents
    await Incident.deleteMany({});
    console.log('Cleared existing incidents');

    const statuses = ['APPROVED', 'OVERRIDDEN', 'RESOLVED', 'DISPATCHED'];
    const now = Date.now();
    const incidents = [];

    // Generate sample incidents
    for (let i = 0; i < 20; i++) {
      const cell = cells[i % cells.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const detectedAt = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000); // Random time in last 7 days
      
      const action = {
        actionNarrative: `Sample incident ${i + 1} for cell ${cell.h3Index}. Risk level ${cell.riskLevel} requires immediate attention.`,
        priority: ['CRITICAL', 'HIGH', 'MODERATE'][Math.floor(Math.random() * 3)],
        recommendedResources: ['Emergency Response Team', 'Medical Unit', 'Traffic Control'].slice(0, Math.floor(Math.random() * 3) + 1),
        dispatchText: `Dispatch emergency response to ${cell.h3Index} location. Coordinate with local authorities.`,
      };

      const incident = {
        h3Index: cell.h3Index,
        cityCode: 'CITY-IND-BPL8',
        riskScore: cell.compositeRisk,
        scores: cell.scores,
        action,
        status,
        operatorId: operator._id,
        detectedAt,
        operatorDecisionAt: new Date(detectedAt.getTime() + Math.random() * 60 * 60 * 1000), // 0-1 hour after detection
        dispatchedAt: status === 'DISPATCHED' || status === 'RESOLVED' ? new Date(detectedAt.getTime() + 2 * 60 * 60 * 1000) : null,
        resolvedAt: status === 'RESOLVED' ? new Date(detectedAt.getTime() + 4 * 60 * 60 * 1000) : null,
        overrideReason: status === 'OVERRIDDEN' ? 'Manual override by operator' : undefined,
        lockOwnerId: operator._id,
      };

      incidents.push(incident);
    }

    await Incident.insertMany(incidents);
    console.log(`Generated ${incidents.length} sample incidents`);

    console.log('\nIncident breakdown by status:');
    const statusBreakdown = {};
    incidents.forEach(inc => {
      statusBreakdown[inc.status] = (statusBreakdown[inc.status] || 0) + 1;
    });
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error generating sample incidents:', error);
    process.exit(1);
  }
}

generateSampleIncidents();
