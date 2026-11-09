import { buildEventIdentity, sourceLabelFor } from '../../src/services/eventProvenance.js';

describe('event provenance', () => {
  const at = new Date('2026-11-09T12:00:00.000Z');

  it('gives the same observation the same identity on a retry', () => {
    const payload = { sensorId: 'RAIN-01', rainMmHr: 12 };
    const first = buildEventIdentity({
      sourceType: 'IOT_SENSOR',
      payload,
      h3Index: '883d914f17fffff',
      observedAt: at,
    });
    const retry = buildEventIdentity({
      sourceType: 'IOT_SENSOR',
      payload: { ...payload },
      h3Index: '883d914f17fffff',
      observedAt: '2026-11-09T12:00:00.000Z',
    });

    expect(retry.eventId).toBe(first.eventId);
    expect(retry.contentHash).toBe(first.contentHash);
  });

  it('treats a new observation time as a new observation', () => {
    const base = {
      sourceType: 'TRAFFIC_API',
      payload: { incidentId: 'tomtom-42' },
      h3Index: '883d914f17fffff',
    };

    const first = buildEventIdentity({ ...base, observedAt: at });
    const later = buildEventIdentity({
      ...base,
      observedAt: new Date('2026-11-09T12:01:00.000Z'),
    });

    expect(later.eventId).not.toBe(first.eventId);
  });

  it('uses an explicit event id as the idempotency key', () => {
    const first = buildEventIdentity({
      sourceType: 'CITIZEN_311',
      payload: { eventId: 'citizen-17', reportText: 'Water on the road' },
      h3Index: '883d914f17fffff',
      observedAt: at,
    });
    const retry = buildEventIdentity({
      sourceType: 'CITIZEN_311',
      payload: { eventId: 'citizen-17', reportText: 'Changed text' },
      h3Index: '883d914f17fffff',
      observedAt: new Date('2026-11-09T12:30:00.000Z'),
    });

    expect(retry.eventId).toBe(first.eventId);
  });

  it('keeps the provider label instead of losing it in the source type', () => {
    expect(sourceLabelFor('TRAFFIC_API', { source: 'tomtom-traffic-flow' })).toBe(
      'tomtom-traffic-flow'
    );
  });
});
