import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    h3Index: { type: String, required: true, index: true },
    cityCode: { type: String, default: 'CITY-IND-BPL8', index: true },
    riskScore: { type: Number, required: true },
    scores: {
      mobility: { type: Number, default: 0 },
      climate: { type: Number, default: 0 },
      vulnerability: { type: Number, default: 0 },
    },
    action: {
      actionNarrative: String,
      priority: { type: String, enum: ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'], default: 'HIGH' },
      recommendedResources: [String],
      dispatchText: String,
    },
    status: {
      type: String,
      enum: ['DETECTED', 'APPROVED', 'OVERRIDDEN', 'DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED', 'RESOLVED', 'ESCALATED'],
      default: 'DETECTED',
      index: true,
    },
    detectedAt: { type: Date, default: Date.now, index: true },
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    operatorDecisionAt: Date,
    overrideReason: String,
    lockOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedCrewId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    dispatchedAt: Date,
    acknowledgedAt: Date,
    arrivedAt: Date,
    resolvedAt: Date,
    escalatedAt: Date,
    escalationCount: { type: Number, default: 0 },
    resolutionNote: String,
    resolutionPhotoUrl: String,
    resolutionLatitude: Number,
    resolutionLongitude: Number,
    fieldNotes: [
      {
        crewId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

incidentSchema.index({ h3Index: 1, status: 1, detectedAt: -1 });
incidentSchema.index({ status: 1, detectedAt: -1 });
incidentSchema.index({ assignedCrewId: 1, status: 1 });
incidentSchema.index({ detectedAt: -1 });

export const Incident = mongoose.model('Incident', incidentSchema);
