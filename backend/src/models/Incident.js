import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    h3Index: { type: String, required: true, index: true },
    riskScore: { type: Number, required: true },
    scores: {
      mobility: Number,
      climate: Number,
      vulnerability: Number,
    },
    action: {
      actionNarrative: String,
      priority: { type: String, enum: ['CRITICAL', 'HIGH'] },
      recommendedResources: [String],
      dispatchText: String,
    },
    status: { type: String, enum: ['DETECTED', 'APPROVED', 'OVERRIDDEN', 'DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED', 'RESOLVED'], default: 'DETECTED' },
    detectedAt: { type: Date, default: Date.now, index: true },
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    operatorDecisionAt: Date,
    overrideReason: String,
    lockOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedCrewId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dispatchedAt: Date,
    acknowledgedAt: Date,
    arrivedAt: Date,
    resolvedAt: Date,
    resolutionNote: String,
    resolutionPhotoUrl: String,
    resolutionLatitude: Number,
    resolutionLongitude: Number,
  },
  { timestamps: true }
);

incidentSchema.index({ h3Index: 1, status: 1, detectedAt: -1 });

export const Incident = mongoose.model('Incident', incidentSchema);