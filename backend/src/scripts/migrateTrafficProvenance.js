import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';

dotenv.config();

/**
 * One-time provenance repair.
 *
 * Before TRAFFIC_API existed, TomTom and field-crew road readings were stored
 * as GTFS_TRANSIT. This relabels those rows so source audits and source health
 * do not describe a traffic measurement as a bus feed.
 */
async function main() {
  await connectDB();

  const result = await TelemetryEvent.updateMany(
    {
      sourceType: 'GTFS_TRANSIT',
      'rawPayload.source': {
        $in: ['tomtom-traffic-flow', 'tomtom-traffic-incidents', 'field-crew-gps'],
      },
    },
    { $set: { sourceType: 'TRAFFIC_API' } }
  );

  console.log(`[migration] Relabelled ${result.modifiedCount} traffic events as TRAFFIC_API.`);
  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error('[migration] Failed:', error.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
