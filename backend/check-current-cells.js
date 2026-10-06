import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env' });

const SpatialCell = mongoose.model('SpatialCell', mongoose.Schema({
  h3Index: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  compositeRisk: { type: Number },
  riskLevel: { type: String },
}));

async function checkCurrentCells() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const cells = await SpatialCell.find({});
    console.log(`\nTotal cells in database: ${cells.length}`);

    if (cells.length > 0) {
      console.log('\nCurrent cell coordinates:');
      cells.forEach(cell => {
        console.log(`  H3: ${cell.h3Index}, Lat: ${cell.latitude}, Lon: ${cell.longitude}, Risk: ${cell.compositeRisk}`);
      });
    } else {
      console.log('No cells found in database');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkCurrentCells();
