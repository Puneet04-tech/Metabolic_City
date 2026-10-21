/**
 * Request Budget Tests
 * Data Integrity Principle: the system never exceeds what a provider allows
 */

import { affordableProbes, pollsLeftToday } from '../../src/services/requestBudget.js';

const atHour = (hour) => new Date(Date.UTC(2026, 0, 1, hour, 0, 0));

describe('pollsLeftToday', () => {
  it('counts the polls that are still to come', () => {
    expect(pollsLeftToday(30, atHour(0))).toBe(48);
    expect(pollsLeftToday(30, atHour(12))).toBe(24);
    expect(pollsLeftToday(30, atHour(23))).toBe(2);
  });

  it('never returns less than one', () => {
    expect(pollsLeftToday(30, atHour(23))).toBeGreaterThanOrEqual(1);
  });
});

describe('affordableProbes', () => {
  const settings = { limit: 2300, pollMinutes: 30, cityCount: 3, maximum: 20 };

  it('fits the whole day inside the allowance', () => {
    // Starting from a full allowance at midnight, the cost of every poll
    // must add up to no more than the allowance.
    let used = 0;
    for (let hour = 0; hour < 24; hour += 1) {
      const now = atHour(hour);
      const remaining = settings.limit - used;
      const plan = affordableProbes({ ...settings, remaining, now });
      const costPerHour = settings.cityCount * (plan.probes + 1) * 2;
      used += costPerHour;
    }
    expect(used).toBeLessThanOrEqual(settings.limit);
  });

  it('drops below the ceiling when the allowance is tight', () => {
    const plan = affordableProbes({
      ...settings,
      remaining: settings.limit,
      now: atHour(0),
    });
    expect(plan.probes).toBeLessThan(settings.maximum);
  });

  it('never asks for more than the ceiling', () => {
    const plan = affordableProbes({
      ...settings,
      remaining: 100000,
      now: atHour(0),
    });
    expect(plan.probes).toBe(settings.maximum);
  });

  it('asks for nothing when the allowance is gone', () => {
    const plan = affordableProbes({ ...settings, remaining: 0, now: atHour(23) });
    expect(plan.probes).toBe(0);
  });

  it('shows what the ceiling would cost over a full day', () => {
    const plan = affordableProbes({ ...settings, remaining: settings.limit, now: atHour(0) });
    // Three cities, twenty readings plus the incident feed, every half hour.
    expect(plan.dailyCost).toBe(48 * 3 * 21);
    expect(plan.dailyCost).toBeGreaterThan(settings.limit);
  });
});
