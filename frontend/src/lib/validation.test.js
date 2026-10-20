import { describe, expect, it } from 'vitest';
import { PASSWORD_RULES, firstInvalidField, hasErrors, validateSignIn, validateSignUp } from './validation.js';

const validSignIn = {
  cityCode: 'CITY-IND-BPL8',
  identifier: 'OP-1042',
  password: 'fleet2026',
};

describe('validateSignIn', () => {
  it('accepts a complete form', () => {
    expect(validateSignIn(validSignIn)).toEqual({});
  });

  it('requires the city code', () => {
    expect(validateSignIn({ ...validSignIn, cityCode: '  ' }).cityCode).toBeTruthy();
  });

  it('rejects a city code with illegal characters', () => {
    expect(validateSignIn({ ...validSignIn, cityCode: 'city code!' }).cityCode).toBeTruthy();
  });

  it('requires the identifier and the password', () => {
    const errors = validateSignIn({ cityCode: 'CITY-IND-BPL8', identifier: '', password: '' });
    expect(errors.identifier).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });
});

describe('validateSignUp', () => {
  const base = { ...validSignIn, name: 'Asha Rao', email: 'asha@example.gov' };

  it('accepts a complete form', () => {
    expect(validateSignUp(base)).toEqual({});
  });

  it('requires a name and a valid email', () => {
    expect(validateSignUp({ ...base, name: '' }).name).toBeTruthy();
    expect(validateSignUp({ ...base, email: 'not-an-email' }).email).toBeTruthy();
  });

  it('applies the same password rules as the API', () => {
    expect(validateSignUp({ ...base, password: 'short1' }).password).toBeTruthy();
    expect(validateSignUp({ ...base, password: 'alllettersonly' }).password).toBeTruthy();
    expect(validateSignUp({ ...base, password: 'nodigitsatall' }).password).toBeTruthy();
    expect(validateSignUp({ ...base, password: 'fleet2026' }).password).toBeUndefined();
  });

  it('lists the password rules up front', () => {
    expect(PASSWORD_RULES.length).toBeGreaterThan(0);
    for (const rule of PASSWORD_RULES) {
      expect(typeof rule.test).toBe('function');
      expect(rule.label).toBeTruthy();
    }
  });
});

describe('hasErrors and firstInvalidField', () => {
  it('detects whether anything is wrong', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ cityCode: 'required' })).toBe(true);
  });

  it('returns the first invalid field in form order', () => {
    const errors = { password: 'x', cityCode: 'y' };
    expect(firstInvalidField(errors, ['cityCode', 'name', 'password'])).toBe('cityCode');
  });

  it('returns undefined when nothing is wrong', () => {
    expect(firstInvalidField({}, ['cityCode'])).toBeUndefined();
  });
});
