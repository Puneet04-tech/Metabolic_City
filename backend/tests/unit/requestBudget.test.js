/**
 * Request Budget Tests
 * Data Integrity Principle: the system never exceeds what a provider allows
 */

import { affordableProbes, pollsLeftThisMonth } from '../../src/services/requestBudget.js';

/** A date in the middle of a 31-day month. */
const midMonth = new Date(Date.UTC(2026, 0, 15, 0, 0, 0));
const firstOfMonth = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

describe('pollsLeftThisMonth', () => {
  it('counts the polls that are still to come in the month', () => {
    // A 31-day month at one poll an hour is 744 hours.
    expect(pollsLeftThisMonth(60, firstOfMonth)).toBe(744);
  });

  it('is shorter at the end of the month', () => {
    expect(pollsLeftThisMonth(60, new Date(Date.UTC(2026, 0, 31, 0, 0, 0)))).toBeLessThan(
      pollsLeftThisMonth(60, firstOfMonth)
    );
  });

  it('never returns less than one', () => {
    expect(pollsLeftThisMonth(60, new Date(Date.UTC(2026, 0, 31, 23, 0, 0)))).toBeGreaterThanOrEqual(1);
  });
});

describe('affordableProbes', () => {
  const settings = {
    flowLimit: 20000,
    incidentLimit: 2500,
    pollMinutes: 60,
    cityCount: 3,
    maximum: 20,
  };

  it('fits a whole month of polls inside both allowances', () => {
    let flowUsed = 0;
    let incidentUsed = 0;

    // Walk the month hour by hour, each time spending what was planned.
    for (let day = 1; day <= 31; day += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        const now = new Date(Date.UTC(2026, 0, day, hour, 0, 0));
        const plan = affordableProbes({
          ...settings,
          flowRemaining: settings.flowLimit - flowUsed,
          incidentRemaining: settings.incidentLimit - incidentUsed,
          now,
        });
        if (plan.probes <= 0) continue;
        const polls = Math.min(plan.affordablePolls, plan.pollsLeft);
        flowUsed += polls * settings.cityCount * plan.probes;
        incidentUsed += polls * settings.cityCount;
      }
    }

    expect(incidentUsed).toBeLessThanOrEqual(settings.incidentLimit);
    expect(flowUsed).toBeLessThanOrEqual(settings.flowLimit);
  });

  it('never asks for more than the ceiling', () => {
    const plan = affordableProbes({
      ...settings,
      flowRemaining: 1000000,
      incidentRemaining: 1000000,
      now: firstOfMonth,
    });
    expect(plan.probes).toBe(settings.maximum);
  });

  it('asks for nothing when the incident allowance is gone', () => {
    const plan = affordableProbes({
      ...settings,
      flowRemaining: 100000,
      incidentRemaining: 0,
      now: firstOfMonth,
    });
    expect(plan.probes).toBe(0);
  });

  it('is limited by the incident allowance rather than the flow one', () => {
    const plan = affordableProbes({
      ...settings,
      flowRemaining: 20000,
      incidentRemaining: 300,
      now: firstOfMonth,
    });
    // Three cities, so 300 incident calls is 100 polls.
    expect(plan.affordablePolls).toBe(100);
  });

  it('is limited by the flow allowance when there is room for the incidents', () => {
    const plan = affordableProbes({
      ...settings,
      flowRemaining: 900,
      incidentRemaining: 2500,
      now: firstOfMonth,
    });
    // 900 readings spread over the polls that are left.
    expect(plan.probes).toBeLessThan(settings.maximum);
  });
});
