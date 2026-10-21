import mongoose from 'mongoose';

/**
 * The real terrain of a cell.
 *
 * Elevation comes from a digital elevation model and the water distance from
 * the nearest real watercourse. Together they say how likely a cell is to
 * pond, which is the part of the risk that does not change with the weather.
 */
const TerrainCellSchema = new mongoose.Schema(
  {
    cityCode: { type: String, required: true, index: true },
    h3Index: { type: String, required: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    elevationM: { type: Number, required: true },
    /** Height above the lowest cell in the city, in metres. */
    reliefM: { type: Number, default: 0 },
    /** Steepest gradient to a neighbouring cell, in degrees. */
    slopeDeg: { type: Number, default: 0 },
    /** Distance to the nearest real watercourse, in metres. */
    waterDistanceM: { type: Number, default: null },
    waterwayName: { type: String, default: '' },
    /** 0 (highest ground, least exposed) to 10 (low, close to water). */
    floodSusceptibility: { type: Number, required: true },
    /** The real streets this cell holds. */
    roadCount: { type: Number, default: 0 },
    /** The classes of the real streets this cell holds. */
    roadClasses: { type: [String], default: [] },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TerrainCellSchema.index({ cityCode: 1, h3Index: 1 }, { unique: true });

export const TerrainCell = mongoose.model('TerrainCell', TerrainCellSchema);
export default TerrainCell;
