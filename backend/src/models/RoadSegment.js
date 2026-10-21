import mongoose from 'mongoose';

/**
 * A real road segment from OpenStreetMap.
 *
 * The segment is the unit the traffic provider probes and the unit the cell
 * set is derived from, so a cell exists because there is a real street in
 * it, not because a simulation put something there.
 */
const RoadSegmentSchema = new mongoose.Schema(
  {
    cityCode: { type: String, required: true, index: true },
    osmId: { type: String, required: true },
    h3Index: { type: String, required: true, index: true },
    name: { type: String, default: '' },
    highway: { type: String, required: true },
    surface: { type: String, default: '' },
    lanes: { type: Number, default: null },
    oneway: { type: Boolean, default: false },
    /** [[latitude, longitude], ...] the real geometry. */
    geometry: { type: [[Number]], default: [] },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    lengthM: { type: Number, default: null },
    /** The nearest named watercourse, when the segment is near one. */
    waterwayName: { type: String, default: '' },
    waterwayDistanceM: { type: Number, default: null },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

RoadSegmentSchema.index({ cityCode: 1, osmId: 1 }, { unique: true });
RoadSegmentSchema.index({ cityCode: 1, h3Index: 1 });

export const RoadSegment = mongoose.model('RoadSegment', RoadSegmentSchema);
export default RoadSegment;
