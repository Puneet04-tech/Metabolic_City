/**
 * SpatialCell Model Tests
 * Maintainability Principle: Testing Strategy - Unit Tests
 */

import { SpatialCell } from '../../src/models/SpatialCell.js';

describe('SpatialCell Model', () => {
  const validCellData = {
    h3Index: '883d914f17fffff',
    latitude: 23.2599,
    longitude: 77.4126,
    compositeRisk: 8.5,
    scores: {
      mobility: 9.0,
      climate: 8.5,
      vulnerability: 7.5,
    },
    riskLevel: 'CRITICAL',
    cityCode: 'CITY-MP-BPL',
  };

  test('should create a valid cell', async () => {
    const cell = await SpatialCell.create(validCellData);
    expect(cell.h3Index).toBe(validCellData.h3Index);
    expect(cell.compositeRisk).toBe(validCellData.compositeRisk);
    expect(cell.riskLevel).toBe('CRITICAL');
  });

  test('should require h3Index', async () => {
    const invalidData = { ...validCellData, h3Index: null };
    await expect(SpatialCell.create(invalidData)).rejects.toThrow();
  });

  test('should validate compositeRisk range (0-10)', async () => {
    const invalidData = { ...validCellData, compositeRisk: 15 };
    await expect(SpatialCell.create(invalidData)).rejects.toThrow();
  });

  test('should validate riskLevel enum', async () => {
    const invalidData = { ...validCellData, riskLevel: 'INVALID' };
    await expect(SpatialCell.create(invalidData)).rejects.toThrow();
  });

  test('should have unique h3Index', async () => {
    await SpatialCell.create(validCellData);
    await expect(SpatialCell.create(validCellData)).rejects.toThrow();
  });
});
