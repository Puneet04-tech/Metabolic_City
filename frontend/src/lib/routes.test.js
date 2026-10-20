import { describe, expect, it } from 'vitest';
import { ROUTES, canAccess, getNavItems, getRoute, safeReturnTo } from './routes.js';
import { ROLES } from './roles.js';

describe('route table', () => {
  it('has a unique id and path for every entry', () => {
    const ids = ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every route a document title', () => {
    for (const route of ROUTES) expect(route.title).toBeTruthy();
  });
});

describe('getNavItems', () => {
  it('never offers an administrator a route the guard would refuse', () => {
    const nav = getNavItems(ROLES.ADMINISTRATOR).map((item) => item.id);
    expect(nav).toContain('admin');
    expect(nav).toContain('analytics');
    expect(nav).not.toContain('operator');
    expect(nav).not.toContain('field');
  });

  it('never offers an operator a field-crew route', () => {
    const nav = getNavItems(ROLES.OPERATOR).map((item) => item.id);
    expect(nav).toEqual(['operator', 'analytics']);
  });

  it('offers a field crew only the field section', () => {
    const nav = getNavItems(ROLES.FIELD_CREW).map((item) => item.id);
    expect(nav).toEqual(['field']);
  });

  it('offers nothing to an anonymous or unknown role', () => {
    expect(getNavItems(null)).toEqual([]);
    expect(getNavItems('municipality')).toEqual([]);
  });

  it('only ever returns routes the role can open', () => {
    for (const role of Object.values(ROLES)) {
      for (const item of getNavItems(role)) {
        expect(canAccess(getRoute(item.id), role)).toBe(true);
      }
    }
  });
});

describe('canAccess', () => {
  it('allows public routes for everyone', () => {
    expect(canAccess(getRoute('home'), null)).toBe(true);
    expect(canAccess(getRoute('login'), null)).toBe(true);
  });

  it('refuses a protected route for the wrong role', () => {
    expect(canAccess(getRoute('operator'), ROLES.FIELD_CREW)).toBe(false);
    expect(canAccess(getRoute('admin'), ROLES.OPERATOR)).toBe(false);
  });

  it('allows a protected route for the right role', () => {
    expect(canAccess(getRoute('operator'), ROLES.OPERATOR)).toBe(true);
    expect(canAccess(getRoute('analytics'), ROLES.ADMINISTRATOR)).toBe(true);
  });
});

describe('safeReturnTo', () => {
  it('accepts a same-origin relative path', () => {
    expect(safeReturnTo('/operator')).toBe('/operator');
    expect(safeReturnTo('/field/tasks/abc?from=list')).toBe('/field/tasks/abc?from=list');
  });

  it('rejects an absolute or protocol-relative url', () => {
    expect(safeReturnTo('https://evil.example')).toBeNull();
    expect(safeReturnTo('//evil.example')).toBeNull();
    expect(safeReturnTo('http://evil.example')).toBeNull();
  });

  it('rejects a redirect back to the auth pages', () => {
    expect(safeReturnTo('/login')).toBeNull();
    expect(safeReturnTo('/signup')).toBeNull();
  });

  it('rejects a missing or non-string value', () => {
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo(42)).toBeNull();
  });
});
