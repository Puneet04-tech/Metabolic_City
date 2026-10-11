import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server.js';
import { SpatialCell } from '../src/models/SpatialCell.js';
import { DeadLetterMessage } from '../src/models/DeadLetterMessage.js';

/**
 * Spatial Cell System Integration Tests
 * Maintainability Principle: Testing Strategy - Automated integration tests
 * 
 * Replaces manual root diagnostic scripts with automated Jest E2E assertions
 * Tests trace 4 Shadow Paths: Happy Path, Nil Input, Empty Input, Upstream Error
 */

describe('Spatial Cell System Integration Tests', () => {
  beforeAll(async () => {
    const testUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
    await mongoose.connect(testUri);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SpatialCell.deleteMany({});
    await DeadLetterMessage.deleteMany({});
  });

  describe('POST /api/v1/telemetry/ingest - Ingestion Boundary Testing', () => {
    it('Path 1 (Happy Path): Processes valid telemetry and enqueues job', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .send({
          lat: 23.2599,
          lng: 77.4126,
          reading: 85.5,
          sensorId: 'SENSOR_BPL_01',
        });

      expect(res.statusCode).toEqual(202);
      expect(res.body).toHaveProperty('status', 'QUEUED');
      expect(res.body).toHaveProperty('jobId');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('Path 2 (Nil Input): Returns HTTP 400 on null payload', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .send(null);

      expect(res.statusCode).toEqual(400);
      expect(res.body.error_code).toEqual('ERR_NIL_TELEMETRY_PAYLOAD');
    });

    it('Path 3 (Empty Input): Returns HTTP 422 on empty body missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .send({});

      expect(res.statusCode).toEqual(422);
      expect(res.body.error_code).toEqual('ERR_INVALID_TELEMETRY_SCHEMA');
    });

    it('Path 4 (Upstream Error): Returns HTTP 422 on missing lat/lng', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .send({
          reading: 85.5,
          sensorId: 'SENSOR_BPL_01',
        });

      expect(res.statusCode).toEqual(422);
      expect(res.body.error_code).toEqual('ERR_INVALID_TELEMETRY_SCHEMA');
    });
  });

  describe('Spatial Cell CRUD Operations', () => {
    it('Happy Path: Creates spatial cell with valid H3 index', async () => {
      const cell = await SpatialCell.create({
        h3Index: '883d914f17fffff',
        latitude: 23.2599,
        longitude: 77.4126,
        compositeRisk: 7.5,
        riskLevel: 'HIGH',
      });

      expect(cell.h3Index).toBe('883d914f17fffff');
      expect(cell.compositeRisk).toBe(7.5);
      expect(cell.riskLevel).toBe('HIGH');
    });

    it('Nil Input: Rejects cell without H3 index', async () => {
      await expect(
        SpatialCell.create({
          latitude: 23.2599,
          longitude: 77.4126,
          compositeRisk: 7.5,
        })
      ).rejects.toThrow();
    });

    it('Empty Input: Rejects cell with invalid risk level', async () => {
      await expect(
        SpatialCell.create({
          h3Index: '883d914f17fffff',
          latitude: 23.2599,
          longitude: 77.4126,
          compositeRisk: 7.5,
          riskLevel: 'INVALID',
        })
      ).rejects.toThrow();
    });
  });

  describe('Geospatial Indexing', () => {
    it('Happy Path: Stores location field with GeoJSON Point', async () => {
      const cell = await SpatialCell.create({
        h3Index: '883d914f17fffff',
        latitude: 23.2599,
        longitude: 77.4126,
        compositeRisk: 7.5,
      });

      expect(cell.location).toBeDefined();
      expect(cell.location.type).toBe('Point');
      expect(cell.location.coordinates).toEqual([77.4126, 23.2599]);
    });

    it('Upstream Error: Auto-populates location from lat/lon', async () => {
      const cell = await SpatialCell.create({
        h3Index: '883d914f17fffff',
        latitude: 23.2599,
        longitude: 77.4126,
        compositeRisk: 7.5,
      });

      expect(cell.location.coordinates[0]).toBe(77.4126); // Longitude first in GeoJSON
      expect(cell.location.coordinates[1]).toBe(23.2599); // Latitude second
    });
  });

  describe('Dead Letter Queue', () => {
    it('Happy Path: Creates dead letter message for failed job', async () => {
      const dlq = await DeadLetterMessage.create({
        jobId: 'test-job-123',
        queueName: 'telemetryIngestion',
        payload: { lat: 23.2599, lng: 77.4126 },
        failedReason: 'Test failure',
        stackTrace: 'Error: Test failure\n    at test.js:1:1',
      });

      expect(dlq.jobId).toBe('test-job-123');
      expect(dlq.queueName).toBe('telemetryIngestion');
      expect(dlq.processed).toBe(false);
    });

    it('Nil Input: Rejects DLQ without jobId', async () => {
      await expect(
        DeadLetterMessage.create({
          queueName: 'telemetryIngestion',
          payload: {},
          failedReason: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('GET /api/v1/spatial-cells - Spatial Cell Queries', () => {
    beforeEach(async () => {
      await SpatialCell.create([
        {
          h3Index: '883d914f17fffff',
          latitude: 23.2599,
          longitude: 77.4126,
          compositeRisk: 8.5,
          riskLevel: 'CRITICAL',
        },
        {
          h3Index: '883d914f1bfffff',
          latitude: 23.26,
          longitude: 77.41,
          compositeRisk: 5.5,
          riskLevel: 'HIGH',
        },
        {
          h3Index: '883d914f1cfffff',
          latitude: 23.27,
          longitude: 77.42,
          compositeRisk: 2.5,
          riskLevel: 'LOW',
        },
      ]);
    });

    it('Happy Path: Returns all spatial cells', async () => {
      const res = await request(app).get('/api/v1/spatial-cells');

      expect(res.statusCode).toEqual(200);
      expect(res.body.cells).toHaveLength(3);
    });

    it('Empty Input: Returns empty array when no cells exist', async () => {
      await SpatialCell.deleteMany({});
      const res = await request(app).get('/api/v1/spatial-cells');

      expect(res.statusCode).toEqual(200);
      expect(res.body.cells).toHaveLength(0);
    });

    it('Happy Path: Filters by risk level', async () => {
      const res = await request(app).get('/api/v1/spatial-cells?riskLevel=CRITICAL');

      expect(res.statusCode).toEqual(200);
      expect(res.body.cells).toHaveLength(1);
      expect(res.body.cells[0].riskLevel).toBe('CRITICAL');
    });
  });

  describe('POST /api/v1/spatial-cells/:h3Index/lock - Cell Locking State Machine', () => {
    it('Path 1 (Happy Path): Locks unlocked cell successfully', async () => {
      const cell = await SpatialCell.create({
        h3Index: '883d914f17fffff',
        latitude: 23.2599,
        longitude: 77.4126,
        compositeRisk: 0.8,
        riskLevel: 'HIGH',
      });

      const res = await request(app)
        .post(`/api/v1/spatial-cells/${cell.h3Index}/lock`)
        .send({ operatorId: 'OP_881', reason: 'Emergency dispatch' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.lockState).toEqual('LOCKED');
      expect(res.body.lockedBy).toEqual('OP_881');
    });

    it('Path 4 (Upstream Error / Race Condition): Rejects locking an already locked cell', async () => {
      const cell = await SpatialCell.create({
        h3Index: '883d914f17fffff',
        latitude: 23.2599,
        longitude: 77.4126,
        compositeRisk: 0.9,
        riskLevel: 'CRITICAL',
        lockState: 'LOCKED',
        lockedBy: 'OP_881',
      });

      const res = await request(app)
        .post(`/api/v1/spatial-cells/${cell.h3Index}/lock`)
        .send({ operatorId: 'OP_992', reason: 'Secondary Lock Attempt' });

      expect(res.statusCode).toEqual(409);
      expect(res.body.error_code).toEqual('CELL_ALREADY_LOCKED');
    });
  });

  describe('Health Check Endpoint', () => {
    it('Happy Path: Returns healthy status when all services ready', async () => {
      const res = await request(app).get('/health');

      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.services.mongodb).toBe('ready');
    });

    it('Happy Path: Includes latency statistics', async () => {
      const res = await request(app).get('/health');

      expect(res.statusCode).toEqual(200);
      expect(res.body.performance).toBeDefined();
      expect(res.body.performance.latency).toBeDefined();
    });
  });
});
