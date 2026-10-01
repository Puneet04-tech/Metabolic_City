import mongoose from 'mongoose';
import { TelemetryEvent } from './src/models/TelemetryEvent.js';
import * as h3 from 'h3-js';
import dotenv from 'dotenv';

dotenv.config();

const H3_RESOLUTION = 8;

function normalizeCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  const h3Fn = h3.latLngToCell || h3.geoToH3;
  if (typeof h3Fn !== 'function') {
    throw new Error('H3 spatial indexing function is unavailable.');
  }
  const h3Index = h3Fn(lat, lon, H3_RESOLUTION);
  return { latitude: lat, longitude: lon, h3Index };
}

// Sample locations in a city (Mumbai-like coordinates)
const sampleLocations = [
  { latitude: 19.0760, longitude: 72.8777 }, // South Mumbai
  { latitude: 19.0835, longitude: 72.8780 }, // Fort
  { latitude: 19.0441, longitude: 72.8280 }, // Dadar
  { latitude: 19.0760, longitude: 72.8870 }, // Churchgate
  { latitude: 19.0176, longitude: 72.8567 }, // Lower Parel
  { latitude: 19.1344, longitude: 72.8258 }, // Andheri
  { latitude: 19.1141, longitude: 72.8682 }, // Bandra
  { latitude: 19.2157, longitude: 72.8440 }, // Thane
  { latitude: 19.2268, longitude: 72.8695 }, // Kalyan
  { latitude: 19.0593, longitude: 72.8295 }, // Sion
];

async function generateSampleTelemetry() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    // Clear existing sample data
    await TelemetryEvent.deleteMany({});
    console.log('Cleared existing telemetry events');

    const now = Date.now();
    const events = [];

    // Generate weather events for all locations
    for (const location of sampleLocations) {
      const coords = normalizeCoordinates(location.latitude, location.longitude);
      for (let i = 0; i < 20; i++) {
        const timeOffset = i * 5 * 60 * 1000; // Every 5 minutes
        events.push({
          h3Index: coords.h3Index,
          sourceType: 'WEATHER_API',
          latitude: location.latitude,
          longitude: location.longitude,
          observedAt: new Date(now - timeOffset).toISOString(),
          rainMmHr: 30 + Math.random() * 70, // High rain 30-100mm/hr for critical risk
          visibilityM: 500 + Math.random() * 3000, // Low visibility 0.5-3.5km
          windGustMps: 15 + Math.random() * 25, // High wind gusts 15-40 m/s
          temperatureC: 25 + Math.random() * 15,
          humidityPct: 70 + Math.random() * 30,
          weatherCondition: ['Heavy Rain', 'Thunderstorm', 'Severe Storm'][Math.floor(Math.random() * 3)],
        });
      }
    }

    // Generate transit events for a subset of locations
    for (let i = 0; i < 100; i++) {
      const location = sampleLocations[Math.floor(Math.random() * sampleLocations.length)];
      const lat = location.latitude + (Math.random() - 0.5) * 0.01;
      const lon = location.longitude + (Math.random() - 0.5) * 0.01;
      const coords = normalizeCoordinates(lat, lon);
      const timeOffset = i * 2 * 60 * 1000; // Every 2 minutes
      const speedMps = 2 + Math.random() * 8; // Low speed 2-10 m/s for higher risk
      const normalSpeedMps = 11.1;
      const baseSpeedReduction = speedMps < normalSpeedMps 
        ? Math.round(((normalSpeedMps - Math.max(0, speedMps)) / normalSpeedMps) * 100) 
        : 0;
      const speedReductionPct = Math.min(100, baseSpeedReduction + Math.floor(Math.random() * 50)); // High delay for critical risk

      events.push({
        h3Index: coords.h3Index,
        sourceType: 'GTFS_TRANSIT',
        latitude: lat,
        longitude: lon,
        observedAt: new Date(now - timeOffset).toISOString(),
        vehicleId: `V${Math.floor(Math.random() * 100)}`,
        routeId: `R${Math.floor(Math.random() * 10)}`,
        delayMins: 10 + Math.random() * 40, // High delay 10-50 minutes
        speedReductionPct,
      });
    }

    // Generate citizen 311 reports
    for (let i = 0; i < 30; i++) {
      const location = sampleLocations[Math.floor(Math.random() * sampleLocations.length)];
      const lat = location.latitude + (Math.random() - 0.5) * 0.01;
      const lon = location.longitude + (Math.random() - 0.5) * 0.01;
      const coords = normalizeCoordinates(lat, lon);
      const timeOffset = i * 10 * 60 * 1000; // Every 10 minutes
      
      events.push({
        h3Index: coords.h3Index,
        sourceType: 'CITIZEN_311',
        latitude: lat,
        longitude: lon,
        observedAt: new Date(now - timeOffset).toISOString(),
        reportText: ['Traffic jam on main road', 'Water logging in area', 'Fallen tree blocking traffic', 'Power outage reported'][Math.floor(Math.random() * 4)],
        senderId: `C${Math.floor(Math.random() * 500)}`,
      });
    }

    // Insert events
    await TelemetryEvent.insertMany(events);
    console.log(`Generated ${events.length} sample telemetry events`);

    console.log('Sample telemetry generation complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error generating sample telemetry:', error);
    process.exit(1);
  }
}

generateSampleTelemetry();
