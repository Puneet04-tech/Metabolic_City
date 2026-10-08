import mongoose from 'mongoose';

/**
 * Transaction Utility
 * Data Integrity Principle: ACID Transactions for critical operations
 */

/**
 * Execute a function within a MongoDB transaction
 * Automatically commits on success, aborts on failure
 * 
 * @param {Function} operation - Async function to execute within transaction
 * @returns {Promise} Result of the operation
 */
export async function withTransaction(operation) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Create incident with transaction
 * Ensures incident creation and cell status update are atomic
 */
export async function createIncidentWithTransaction(incidentData, cellUpdate) {
  return withTransaction(async (session) => {
    const { Incident } = await import('../models/Incident.js');
    const { SpatialCell } = await import('../models/SpatialCell.js');

    // Create incident
    const incident = await Incident.create([incidentData], { session });

    // Update cell status
    if (cellUpdate) {
      await SpatialCell.updateOne(
        { h3Index: incidentData.h3Index },
        cellUpdate,
        { session }
      );
    }

    return incident[0];
  });
}

/**
 * Dispatch incident with transaction
 * Ensures incident status update and field crew assignment are atomic
 */
export async function dispatchIncidentWithTransaction(incidentId, dispatchData) {
  return withTransaction(async (session) => {
    const { Incident } = await import('../models/Incident.js');
    const { User } = await import('../models/User.js');

    // Update incident status
    const incident = await Incident.findByIdAndUpdate(
      incidentId,
      { ...dispatchData, status: 'DISPATCHED' },
      { session, new: true }
    );

    // Assign to field crew if specified
    if (dispatchData.assignedCrewId) {
      await User.findByIdAndUpdate(
        dispatchData.assignedCrewId,
        { $push: { assignedTasks: incidentId } },
        { session }
      );
    }

    return incident;
  });
}

/**
 * Resolve incident with transaction
 * Ensures incident resolution and task completion are atomic
 */
export async function resolveIncidentWithTransaction(incidentId, resolutionData) {
  return withTransaction(async (session) => {
    const { Incident } = await import('../models/Incident.js');
    const { User } = await import('../models/User.js');
    const { SpatialCell } = await import('../models/SpatialCell.js');

    // Get incident details
    const incident = await Incident.findById(incidentId).session(session);
    if (!incident) {
      throw new Error('Incident not found');
    }

    // Update incident status
    incident.status = 'RESOLVED';
    incident.resolution = resolutionData;
    incident.resolvedAt = new Date();
    await incident.save({ session });

    // Remove from field crew's assigned tasks
    if (incident.assignedCrewId) {
      await User.findByIdAndUpdate(
        incident.assignedCrewId,
        { $pull: { assignedTasks: incidentId } },
        { session }
      );
    }

    // Update cell risk level based on resolution
    if (resolutionData.riskReduction) {
      await SpatialCell.updateOne(
        { h3Index: incident.h3Index },
        { 
          $inc: { compositeRisk: -resolutionData.riskReduction },
          lastUpdated: new Date(),
        },
        { session }
      );
    }

    return incident;
  });
}

/**
 * Create user with transaction
 * Ensures user creation and role assignment are atomic
 */
export async function createUserWithTransaction(userData) {
  return withTransaction(async (session) => {
    const { User } = await import('../models/User.js');

    const user = await User.create([userData], { session });
    return user[0];
  });
}

/**
 * Bulk update cells with transaction
 * Ensures all cell updates succeed or none do
 */
export async function bulkUpdateCellsWithTransaction(updates) {
  return withTransaction(async (session) => {
    const { SpatialCell } = await import('../models/SpatialCell.js');

    const operations = updates.map((update) => ({
      updateOne: {
        filter: { h3Index: update.h3Index },
        update: update.data,
      },
    }));

    const result = await SpatialCell.bulkWrite(operations, { session });
    return result;
  });
}
