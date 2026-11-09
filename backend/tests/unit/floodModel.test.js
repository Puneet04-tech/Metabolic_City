import {
  curveNumber,
  scsRunoffMm,
  timeOfConcentrationMinutes,
} from '../../src/services/floodModel.js';

describe('screening flood model', () => {
  it('produces no runoff without rain', () => {
    expect(scsRunoffMm(0, 85)).toBe(0);
  });

  it('produces more runoff as rainfall increases', () => {
    const light = scsRunoffMm(10, 85);
    const heavy = scsRunoffMm(60, 85);
    expect(heavy).toBeGreaterThan(light);
  });

  it('produces more runoff on a more paved cell', () => {
    const green = curveNumber({ roadCount: 1, floodSusceptibility: 0.2 });
    const paved = curveNumber({ roadCount: 20, floodSusceptibility: 0.8 });
    expect(paved).toBeGreaterThan(green);
    expect(paved).toBeLessThanOrEqual(95);
  });

  it('sheds water faster on a steep cell', () => {
    expect(timeOfConcentrationMinutes(8)).toBeLessThan(timeOfConcentrationMinutes(0.2));
  });

  it('keeps time of concentration inside its documented bounds', () => {
    expect(timeOfConcentrationMinutes(90)).toBeGreaterThanOrEqual(10);
    expect(timeOfConcentrationMinutes(0)).toBeLessThanOrEqual(180);
  });
});
