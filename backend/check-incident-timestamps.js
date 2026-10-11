import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkIncidentData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const { Incident } = await import('./src/models/Incident.js');
    
    // Get all incidents
    const incidents = await Incident.find({}).sort({ detectedAt: -1 }).limit(5).lean();
    
    console.log('\n=== RECENT INCIDENTS ===');
    incidents.forEach((incident, idx) => {
      console.log(`\nIncident ${idx + 1}:`);
      console.log(`  ID: ${incident._id}`);
      console.log(`  Status: ${incident.status}`);
      console.log(`  detectedAt: ${incident.detectedAt}`);
      console.log(`  operatorDecisionAt: ${incident.operatorDecisionAt}`);
      console.log(`  dispatchedAt: ${incident.dispatchedAt}`);
      console.log(`  Has both timestamps: ${!!(incident.detectedAt && incident.operatorDecisionAt)}`);
      
      if (incident.detectedAt && incident.operatorDecisionAt) {
        const diff = new Date(incident.operatorDecisionAt) - new Date(incident.detectedAt);
        console.log(`  Time difference: ${diff}ms (${(diff / 1000).toFixed(1)}s)`);
      }
    });

    // Count incidents with both timestamps
    const withBoth = await Incident.countDocuments({
      detectedAt: { $exists: true, $ne: null },
      operatorDecisionAt: { $exists: true, $ne: null }
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total incidents: ${await Incident.countDocuments()}`);
    console.log(`Incidents with both timestamps: ${withBoth}`);
    console.log(`Incidents missing timestamps: ${await Incident.countDocuments() - withBoth}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkIncidentData();
