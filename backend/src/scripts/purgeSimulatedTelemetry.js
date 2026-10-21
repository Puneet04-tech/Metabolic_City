/**
 * Purges the telemetry that came from the old simulation.
 *
 * Before the real data sources were added, the pipeline generated modelled
 * transit events and wrote a single city-centre weather reading into eleven
 * cells. Those events are still in the database, they score cells, and they
 * have no marker that says they were made up.
 *
 * This removes them, and the cells that only existed because of them, so
 * every score in the system is made of real observations.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { SpatialCell } from '../models/SpatialCell.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

async function purge() {
  await connectDB();

  const simulatedTransit = await TelemetryEvent.deleteMany({
    sourceType: 'GTFS_TRANSIT',
    $or: [
      { rawPayload: { $exists: false } },
      { 'rawPayload.pipelineGenerated': { $exists: false } },
      { 'rawPayload.simulated': true },
    ],
  });

  const syntheticWeather = await TelemetryEvent.deleteMany({
    sourceType: 'WEATHER_API',
    'rawPayload.synthetic': true,
  });

  const syntheticGis = await TelemetryEvent.deleteMany({
    sourceType: 'GIS_STATIC',
    'rawPayload.synthetic': true,
  });

  console.log(
    `Removed ${simulatedTransit.deletedCount} modelled transit events, ` +
      `${syntheticWeather.deletedCount} synthetic weather events, ` +
      `${syntheticGis.deletedCount} synthetic survey events.`
  );

  // A cell that no longer has any telemetry is a cell that no longer
  // describes anything.
  const live = new Set((await TelemetryEvent.distinct('h3Index')).filter(Boolean));
  const stale = await SpatialCell.find({ h3Index: { $nin: [...live] } }, { h3Index: 1 }).lean();
  if (stale.length) {
    await SpatialCell.deleteMany({ h3Index: { $in: stale.map((cell) => cell.h3Index) } });
  }
  console.log(`Removed ${stale.length} cells that had no telemetry left.`);

  // Cells left over from the old design, where a cell existed because the
  // simulation had put a vehicle in it. A real cell is one that holds real
  // ground: terrain, a road speed reading, or a report from someone.
  const grounded = new Set(
    (
      await TelemetryEvent.distinct('h3Index', {
        sourceType: { $in: ['GIS_STATIC', 'GTFS_TRANSIT', 'CITIZEN_311', 'IOT_SENSOR'] },
      })
    ).filter(Boolean)
  );
  const ungrounded = await SpatialCell.find(
    { h3Index: { $nin: [...grounded] } },
    { h3Index: 1 }
  ).lean();
  if (ungrounded.length) {
    await SpatialCell.deleteMany({ h3Index: { $in: ungrounded.map((cell) => cell.h3Index) } });
  }
  console.log(`Removed ${ungrounded.length} cells that hold no real ground.`);

  const remaining = await TelemetryEvent.aggregate([
    { $group: { _id: '$sourceType', n: { $sum: 1 }, synthetic: { $sum: { $cond: [{ $eq: ['$rawPayload.synthetic', true] }, 1, 0] } } } },
  ]);
  const cells = await SpatialCell.countDocuments();
  console.log('Remaining telemetry:', JSON.stringify(remaining));
  console.log(`Spatial cells: ${cells}`);

  await mongoose.disconnect();
}

purge().catch((error) => {
  console.error('[purge] failed:', error.message);
  process.exitCode = 1;
});
