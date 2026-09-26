import mongoose from 'mongoose';

const telemetryEventSchema = new mongoose.Schema(
  {
    sourceType: { type: String, enum: ['GTFS_TRANSIT', 'WEATHER_API', 'CITIZEN_311', 'GIS_STATIC'], required: true },
    h3Index: { type: String, required: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    observedAt: { type: Date, required: true },
    routeId: String,
    vehicleId: String,
    delayMins: Number,
    speedReductionPct: Number,
    rainMmHr: Number,
    visibilityM: Number,
    windGustMps: Number,
    vulnerabilityScore: Number,
    senderId: String,
    reportText: String,
    imageUrls: [String],
    rawPayload: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

telemetryEventSchema.index({ h3Index: 1, observedAt: -1 });
telemetryEventSchema.index({ observedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const TelemetryEvent = mongoose.model('TelemetryEvent', telemetryEventSchema);