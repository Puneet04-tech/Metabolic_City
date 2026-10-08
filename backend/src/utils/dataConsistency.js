import mongoose from 'mongoose';
import { Incident } from '../models/Incident.js';
import { SpatialCell } from '../models/SpatialCell.js';

/**
 * Data Consistency Patterns
 * Data Integrity Principle: Data Consistency - Event sourcing and CQRS patterns
 */

/**
 * Event Store Schema
 * For event sourcing - immutable log of all state changes
 */
const eventSchema = new mongoose.Schema({
  eventType: { type: String, required: true, index: true },
  aggregateId: { type: String, required: true, index: true }, // incident ID, cell ID, etc.
  aggregateType: { type: String, required: true }, // 'incident', 'cell', 'user'
  version: { type: Number, required: true }, // Event version for this aggregate
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  causationId: { type: String }, // ID of event that caused this event
  correlationId: { type: String }, // Request ID for tracing
});

eventSchema.index({ aggregateId: 1, version: 1 }, { unique: true });
eventSchema.index({ eventType: 1, timestamp: -1 });

export const EventStore = mongoose.models.EventStore || mongoose.model('EventStore', eventSchema);

/**
 * Save event to event store
 * Event Sourcing Pattern: Immutable log of all state changes
 */
export async function saveEvent(eventType, aggregateId, aggregateType, data, options = {}) {
  const lastEvent = await EventStore.findOne(
    { aggregateId, aggregateType },
    {},
    { sort: { version: -1 } }
  );
  
  const version = (lastEvent?.version || 0) + 1;
  
  const event = await EventStore.create({
    eventType,
    aggregateId,
    aggregateType,
    version,
    data,
    causationId: options.causationId,
    correlationId: options.correlationId,
  });
  
  return event;
}

/**
 * Replay events to rebuild state
 * Event Sourcing Pattern: Rebuild state from event log
 */
export async function replayEvents(aggregateId, aggregateType) {
  const events = await EventStore.find({
    aggregateId,
    aggregateType,
  }).sort({ version: 1 });
  
  const state = events.reduce((acc, event) => {
    return applyEvent(acc, event);
  }, {});
  
  return state;
}

/**
 * Apply event to state
 * Event Sourcing Pattern: Event handler
 */
function applyEvent(state, event) {
  switch (event.eventType) {
    case 'INCIDENT_CREATED':
      return {
        ...state,
        status: 'CREATED',
        createdAt: event.timestamp,
        ...event.data,
      };
    case 'INCIDENT_DISPATCHED':
      return {
        ...state,
        status: 'DISPATCHED',
        dispatchedAt: event.timestamp,
        ...event.data,
      };
    case 'INCIDENT_RESOLVED':
      return {
        ...state,
        status: 'RESOLVED',
        resolvedAt: event.timestamp,
        ...event.data,
      };
    case 'CELL_RISK_UPDATED':
      return {
        ...state,
        compositeRisk: event.data.compositeRisk,
        riskLevel: event.data.riskLevel,
        lastUpdated: event.timestamp,
      };
    default:
      return state;
  }
}

/**
 * Saga for distributed transactions
 * Data Consistency Pattern: Saga pattern for cross-service consistency
 */
export class IncidentDispatchSaga {
  constructor(incidentId, dispatchData) {
    this.incidentId = incidentId;
    this.dispatchData = dispatchData;
    this.steps = [];
    this.compensatingActions = [];
  }

  /**
   * Execute saga steps
   */
  async execute() {
    try {
      // Step 1: Update incident status
      await this.updateIncidentStatus();
      this.steps.push('updateIncidentStatus');
      
      // Step 2: Assign to field crew
      await this.assignToFieldCrew();
      this.steps.push('assignToFieldCrew');
      
      // Step 3: Update cell risk level
      await this.updateCellRisk();
      this.steps.push('updateCellRisk');
      
      // Step 4: Send notification
      await this.sendNotification();
      this.steps.push('sendNotification');
      
      return { success: true, steps: this.steps };
    } catch (error) {
      // Compensating transaction: rollback all steps
      await this.compensate();
      throw error;
    }
  }

  async updateIncidentStatus() {
    const incident = await Incident.findByIdAndUpdate(
      this.incidentId,
      { status: 'DISPATCHED', ...this.dispatchData },
      { new: true }
    );
    
    this.compensatingActions.push({
      action: 'revertIncidentStatus',
      data: { status: incident.status },
    });
    
    return incident;
  }

  async assignToFieldCrew() {
    const { User } = await import('../models/User.js');
    
    await User.findByIdAndUpdate(
      this.dispatchData.assignedCrewId,
      { $push: { assignedTasks: this.incidentId } }
    );
    
    this.compensatingActions.push({
      action: 'removeTaskFromCrew',
      crewId: this.dispatchData.assignedCrewId,
    });
  }

  async updateCellRisk() {
    await SpatialCell.updateOne(
      { h3Index: this.dispatchData.h3Index },
      { riskLevel: 'CRITICAL', lastUpdated: new Date() }
    );
    
    this.compensatingActions.push({
      action: 'revertCellRisk',
      h3Index: this.dispatchData.h3Index,
    });
  }

  async sendNotification() {
    // Placeholder for notification service
    console.log(`[Saga] Sending notification for incident ${this.incidentId}`);
  }

  /**
   * Compensating transaction: rollback all steps
   */
  async compensate() {
    console.error('[Saga] Compensating transaction, rolling back steps:', this.steps);
    
    for (const action of this.compensatingActions.reverse()) {
      try {
        if (action.action === 'revertIncidentStatus') {
          await Incident.findByIdAndUpdate(
            this.incidentId,
            { status: action.data.status }
          );
        }
        
        if (action.action === 'removeTaskFromCrew') {
          const { User } = await import('../models/User.js');
          await User.findByIdAndUpdate(
            action.crewId,
            { $pull: { assignedTasks: this.incidentId } }
          );
        }
        
        if (action.action === 'revertCellRisk') {
          await SpatialCell.updateOne(
            { h3Index: action.h3Index },
            { lastUpdated: new Date() }
          );
        }
      } catch (error) {
        console.error('[Saga] Error during compensation:', error.message);
      }
    }
  }
}

/**
 * CQRS Pattern: Separate read and write models
 * For optimized queries and eventual consistency
 */
export class IncidentReadModel {
  /**
   * Get incident with pre-computed aggregations
   */
  static async getIncidentWithStats(incidentId) {
    const incident = await Incident.findById(incidentId).lean();
    
    if (!incident) return null;
    
    // Pre-compute aggregations for read performance
    const stats = {
      timeToDispatch: incident.dispatchedAt 
        ? new Date(incident.dispatchedAt) - new Date(incident.createdAt)
        : null,
      timeToResolution: incident.resolvedAt
        ? new Date(incident.resolvedAt) - new Date(incident.createdAt)
        : null,
      isOverdue: incident.status !== 'RESOLVED' && incident.resolvedAt 
        ? new Date() > new Date(incident.resolvedAt)
        : false,
    };
    
    return { ...incident, stats };
  }

  /**
   * Get all incidents with pre-computed aggregations
   */
  static async getAllIncidentsWithStats(filters = {}) {
    const incidents = await Incident.find(filters).lean();
    
    return incidents.map(incident => ({
      ...incident,
      stats: {
        timeToDispatch: incident.dispatchedAt 
          ? new Date(incident.dispatchedAt) - new Date(incident.createdAt)
          : null,
        timeToResolution: incident.resolvedAt
          ? new Date(incident.resolvedAt) - new Date(incident.createdAt)
          : null,
        isOverdue: incident.status !== 'RESOLVED' && incident.resolvedAt
          ? new Date() > new Date(incident.resolvedAt)
          : false,
      },
    }));
  }
}

/**
 * Get events for an aggregate
 */
export async function getEventsForAggregate(aggregateId, aggregateType) {
  return EventStore.find({
    aggregateId,
    aggregateType,
  }).sort({ version: 1 });
}

/**
 * Get events by type
 */
export async function getEventsByType(eventType, limit = 100) {
  return EventStore.find({ eventType })
    .sort({ timestamp: -1 })
    .limit(limit);
}
