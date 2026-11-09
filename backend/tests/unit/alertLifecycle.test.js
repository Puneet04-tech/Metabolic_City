import { deriveVerification, fallbackAlertKey } from '../../src/services/alertService.js';

const observation = (overrides = {}) => ({
  sourceType: 'CITIZEN_311',
  senderId: 'resident-1',
  category: 'WATERLOGGING',
  ...overrides,
});

describe('alert evidence', () => {
  it('keeps a single resident report unverified', () => {
    const result = deriveVerification(
      { type: 'REPORT', category: 'WATERLOGGING' },
      [observation()]
    );
    expect(result.verification).toBe('UNVERIFIED');
    expect(result.evidenceCount).toBe(1);
  });

  it('corroborates two different residents reporting the same hazard', () => {
    const result = deriveVerification(
      { type: 'REPORT', category: 'WATERLOGGING' },
      [observation(), observation({ senderId: 'resident-2' })]
    );
    expect(result.verification).toBe('CORROBORATED');
    expect(result.evidenceCount).toBe(2);
  });

  it('does not count one resident sending the same report twice as corroboration', () => {
    const result = deriveVerification(
      { type: 'REPORT', category: 'WATERLOGGING' },
      [observation(), observation({ eventId: 'second-copy' })]
    );
    expect(result.verification).toBe('UNVERIFIED');
  });

  it('marks a field crew report as verified', () => {
    const result = deriveVerification(
      { type: 'REPORT', category: 'WATERLOGGING' },
      [observation({ senderId: 'CREW_123' })]
    );
    expect(result.verification).toBe('VERIFIED');
  });

  it('separates a provider incident from an observed slowdown', () => {
    expect(deriveVerification({ type: 'INCIDENT' }, []).verification).toBe(
      'PROVIDER_REPORTED'
    );
    expect(deriveVerification({ type: 'CONGESTION' }, []).verification).toBe('OBSERVED');
  });

  it('uses a field crew report as corroboration for a provider alert in the same cell', () => {
    const result = deriveVerification(
      { type: 'INCIDENT' },
      [observation({ senderId: 'CREW_123' })]
    );
    expect(result.verification).toBe('CORROBORATED');
  });
});

describe('alert keys', () => {
  it('produces the same lifecycle key for the same alert snapshot', () => {
    const alert = {
      type: 'CONGESTION',
      title: 'Slow traffic',
      detail: '40% below free flow',
    };
    expect(fallbackAlertKey(alert, '883d914f17fffff')).toBe(
      fallbackAlertKey({ ...alert }, '883d914f17fffff')
    );
  });
});
