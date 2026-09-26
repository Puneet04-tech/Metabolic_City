import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { normalizeCoordinates, recalculateCell } from '../engine/risk.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const locations = {
  Bhopal: { latitude: 23.2599, longitude: 77.4126 },
  Sehore: { latitude: 23.2032, longitude: 77.0844 },
  Ashta: { latitude: 23.0175, longitude: 76.7221 },
};

function rowsFromWorkbook(fileName, sheetName) {
  const workbook = XLSX.readFile(path.join(root, fileName));
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
}

function average(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

async function seed() {
  await connectDB();
  const publicRows = rowsFromWorkbook('MetabolicCity_AI_Public_and_Corridor_Survey_FILLED.xlsx', 'Public Survey');
  const municipalRows = rowsFromWorkbook('MetabolicCity_AI_Municipal_Survey_FILLED.xlsx', 'Municipal Survey');
  const cells = new Set();

  for (const [location, coordinates] of Object.entries(locations)) {
    const publicLocationRows = publicRows.filter((row) => row.Location === location);
    const municipalLocationRows = municipalRows.filter((row) => row.Location === location);
    const normalized = normalizeCoordinates(coordinates.latitude, coordinates.longitude);
    const observedAt = new Date();
    const delayMins = average(publicLocationRows, 'C1.2 Peak Delay (min)');
    const rainExtraMins = average(publicLocationRows, 'C1.3 Rain Extra Time (min)');
    const vulnerabilityScore = Math.min(10, (municipalLocationRows.length + publicLocationRows.length) / 3);

    await TelemetryEvent.create([
      {
        sourceType: 'GTFS_TRANSIT',
        ...normalized,
        observedAt,
        delayMins,
        rawPayload: { synthetic: true, source: 'Public Survey', location, responseCount: publicLocationRows.length },
      },
      {
        sourceType: 'WEATHER_API',
        ...normalized,
        observedAt,
        rainMmHr: rainExtraMins * 2,
        rawPayload: { synthetic: true, source: 'Public Survey', location, responseCount: publicLocationRows.length },
      },
      {
        sourceType: 'GIS_STATIC',
        ...normalized,
        observedAt,
        vulnerabilityScore,
        rawPayload: { synthetic: true, source: 'Municipal Survey', location, responseCount: municipalLocationRows.length },
      },
    ]);
    cells.add(normalized.h3Index);
  }

  for (const h3Index of cells) await recalculateCell(h3Index);
  console.log(`Seeded synthetic calibration telemetry for ${cells.size} H3 cells.`);
  await import('mongoose').then(({ default: mongoose }) => mongoose.disconnect());
}

seed().catch(async (error) => {
  console.error('[seed] failed:', error.message);
  process.exitCode = 1;
});