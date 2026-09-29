import mongoose from 'mongoose';

const telemetryEventSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ['GTFS_TRANSIT', 'WEATHER_API', 'CITIZEN_311', 'GIS_STATIC', 'IOT_SENSOR'],
      required: true,
      index: true,
    },
    h3Index: { type: String, required: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    cityCode: { type: String, default: 'CITY-IND-BPL8', index: true },
    observedAt: { type: Date, required: true, index: true },
    // Mobility attributes
    routeId: String,
    vehicleId: String,
    delayMins: Number,
    speedReductionPct: Number,
    congestionLevel: { type: String, enum: ['LOW', 'MODERATE', 'SEVERE', 'STANDSTILL'] },
    // Meteorological attributes
    rainMmHr: Number,
    visibilityM: Number,
    windGustMps: Number,
    temperatureC: Number,
    humidityPct: Number,
    weatherCondition: String,
    // Vulnerability & Citizen attributes
    vulnerabilityScore: Number,
    category: {
      type: String,
      enum: ['WATERLOGGING', 'TRAFFIC_JAM', 'ROAD_BLOCK', 'FALLEN_TREE', 'OPEN_MANHOLE', 'POWER_HAZARD', 'STRUCTURAL_DAMAGE', 'GENERAL_HAZARD'],
    },
    senderId: String,
    reportText: String,
    imageUrls: [String],
    verified: { type: Boolean, default: false },
    rawPayload: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

telemetryEventSchema.index({ h3Index: 1, observedAt: -1 });
telemetryEventSchema.index({ sourceType: 1, observedAt: -1 });
telemetryEventSchema.index({ observedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // 7-day retention

export const TelemetryEvent = mongoose.model('TelemetryEvent', telemetryEventSchema);
