import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Landing from './Landing.jsx';
import SignIn from './SignIn.jsx';
import SignUp from './SignUp.jsx';
import { AUTH_NOTICES } from '../lib/useAuthNotice.js';

const render = (element) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

describe('Landing', () => {
  const html = render(<Landing />);

  it('leads with a plain headline in one colour', () => {
    expect(html).toContain('Know which cells need attention');
  });

  it('offers the real onboarding path and an in-page anchor', () => {
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="#how-it-works"');
  });

  it('has anchor navigation for features, roles and platform', () => {
    expect(html).toContain('href="#capabilities"');
    expect(html).toContain('href="#roles"');
    expect(html).toContain('href="#how-it-works"');
  });

  it('explains the scoring with the real formula and thresholds', () => {
    expect(html).toContain('Rc = Wm·Sm + Wc·Sc + Wv·Sv');
    expect(html).toContain('Critical at 7, caution at 5');
    expect(html).toContain('60-minute window');
  });

  it('makes no unverified claims', () => {
    expect(html).not.toMatch(/\bAI\b/);
    for (const claim of ['machine learning', '<1s', '24/7', 'intelligent', 'AI-powered']) {
      expect(html.toLowerCase()).not.toContain(claim.toLowerCase());
    }
  });

  it('has no emoji and no statistics', () => {
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(html).not.toContain('Active H3 Cells');
    expect(html).not.toContain('Detection Time');
  });

  it('does not link to pages that do not exist', () => {
    expect(html).not.toContain('Privacy Policy');
    expect(html).not.toContain('Terms of Service');
  });

  it('shows the current year in the footer', () => {
    expect(html).toContain(String(new Date().getFullYear()));
  });
});

describe('SignIn', () => {
  const html = render(<SignIn />);

  it('uses visible labels for every control', () => {
    expect(html).toContain('City code');
    expect(html).toContain('Operator ID');
    expect(html).toContain('Password');
  });

  it('offers the three roles as a radio group', () => {
    expect(html).toContain('type="radio"');
    expect(html).toContain('Operator');
    expect(html).toContain('Field crew');
    expect(html).toContain('Administrator');
  });

  it('does not show the password rules on sign in', () => {
    expect(html).not.toContain('Contains a number');
  });
});

describe('SignUp', () => {
  const html = render(<SignUp />);

  it('asks for the details the API requires', () => {
    expect(html).toContain('Full name');
    expect(html).toContain('Email address');
    expect(html).toContain('Municipality code');
  });

  it('shows the password rules up front', () => {
    expect(html).toContain('At least 8 characters');
    expect(html).toContain('Contains a letter');
    expect(html).toContain('Contains a number');
  });
});

describe('auth notice lookup', () => {
  it('has a message for every known code', () => {
    expect(AUTH_NOTICES.inactivity.message).toContain('inactivity');
    expect(AUTH_NOTICES.forbidden).toBeTruthy();
    expect(AUTH_NOTICES.session_expired).toBeTruthy();
  });

  it('falls back to a safe generic message for an unknown code', () => {
    expect(AUTH_NOTICES.unknown.message).not.toContain('undefined');
    expect(AUTH_NOTICES.unknown.tone).toBe('error');
  });
});
