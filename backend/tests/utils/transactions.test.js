/**
 * Transaction Utility Tests
 * Data Integrity Principle: ACID Transactions - Unit Tests
 */

import { withTransaction } from '../../src/utils/transactions.js';
import { SpatialCell } from '../../src/models/SpatialCell.js';

describe('Transaction Utility', () => {
  test('should commit transaction on success', async () => {
    const cellData = {
      h3Index: '883d914f17fffff',
      latitude: 23.2599,
      longitude: 77.4126,
      compositeRisk: 8.5,
      riskLevel: 'CRITICAL',
    };

    const result = await withTransaction(async (session) => {
      const cell = await SpatialCell.create([cellData], { session });
      return cell[0];
    });

    expect(result.h3Index).toBe(cellData.h3Index);
    
    // Verify it was actually committed
    const found = await SpatialCell.findOne({ h3Index: cellData.h3Index });
    expect(found).toBeTruthy();
  });

  test('should abort transaction on error', async () => {
    const cellData = {
      h3Index: '883d914f17fffff',
      latitude: 23.2599,
      longitude: 77.4126,
      compositeRisk: 8.5,
      riskLevel: 'CRITICAL',
    };

    await expect(
      withTransaction(async (session) => {
        await SpatialCell.create([cellData], { session });
        throw new Error('Intentional error');
      })
    ).rejects.toThrow('Intentional error');

    // Verify it was rolled back
    const found = await SpatialCell.findOne({ h3Index: cellData.h3Index });
    expect(found).toBeNull();
  });
});
