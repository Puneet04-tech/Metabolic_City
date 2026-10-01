import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Incident } from './src/models/Incident.js';

dotenv.config();

async function createSampleIncidents() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    await Incident.deleteMany({});
    console.log('Cleared existing incidents');

    const sampleIncidents = [
      {
        h3Index: '88608b0b13fffff',
        riskScore: 8.5,
        status: 'DETECTED',
        action: {
          priority: 'CRITICAL',
          recommendedResources: ['Emergency response team', 'Medical units', 'Traffic control'],
          dispatchText: 'Deploy emergency response to critical municipal hazard. Immediate evacuation recommended.',
          actionNarrative: 'Critical municipal hazard detected in H3 cell 88608b0b13fffff. High risk of flooding and infrastructure damage. Immediate action required.'
        },
        scores: { mobility: 9.0, climate: 8.5, vulnerability: 7.5 },
        detectedAt: new Date(),
      },
      {
        h3Index: '88608b0b61fffff',
        riskScore: 7.8,
        status: 'DETECTED',
        action: {
          priority: 'CRITICAL',
          recommendedResources: ['Fire department', 'Rescue teams'],
          dispatchText: 'High-risk area requiring immediate fire and rescue deployment.',
          actionNarrative: 'Severe weather conditions detected in H3 cell 88608b0b61fffff. Fire and rescue teams on standby.'
        },
        scores: { mobility: 8.2, climate: 7.5, vulnerability: 7.0 },
        detectedAt: new Date(),
      },
      {
        h3Index: '88608b0b23fffff',
        riskScore: 7.2,
        status: 'DETECTED',
        action: {
          priority: 'CRITICAL',
          recommendedResources: ['Traffic control', 'Road maintenance'],
          dispatchText: 'Severe traffic congestion and road hazards detected.',
          actionNarrative: 'Critical traffic conditions in H3 cell 88608b0b23fffff. Roads may be impassable.'
        },
        scores: { mobility: 7.5, climate: 7.0, vulnerability: 6.5 },
        detectedAt: new Date(),
      },
      {
        h3Index: '88608b0b31fffff',
        riskScore: 6.5,
        status: 'DETECTED',
        action: {
          priority: 'HIGH',
          recommendedResources: ['Medical units'],
          dispatchText: 'Medical support recommended for affected area.',
          actionNarrative: 'High risk area with potential health hazards in H3 cell 88608b0b31fffff.'
        },
        scores: { mobility: 7.0, climate: 6.5, vulnerability: 5.5 },
        detectedAt: new Date(),
      },
      {
        h3Index: '88608b0b41fffff',
        riskScore: 5.8,
        status: 'DETECTED',
        action: {
          priority: 'HIGH',
          recommendedResources: ['Utility crews'],
          dispatchText: 'Utility infrastructure at risk. Monitoring required.',
          actionNarrative: 'High risk to utility infrastructure in H3 cell 88608b0b41fffff.'
        },
        scores: { mobility: 6.5, climate: 6.0, vulnerability: 4.5 },
        detectedAt: new Date(),
      },
    ];

    for (const incidentData of sampleIncidents) {
      await Incident.create(incidentData);
    }

    console.log(`Created ${sampleIncidents.length} sample incidents`);
    console.log('\nIncidents created:');
    sampleIncidents.forEach(incident => {
      console.log(`- ${incident.h3Index}: Risk ${incident.riskScore} (${incident.action.priority})`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createSampleIncidents();
