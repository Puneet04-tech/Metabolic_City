import { ROLES, normalizeRole } from './roles.js';

/**
 * One route table.
 *
 * The same entry drives the router, the guard and the navigation, so a link
 * can never point at a route the current role cannot open.
 */
export const ROUTES = [
  {
    id: 'home',
    path: '/',
    title: 'Metabolic City | Urban risk operations',
    description:
      'Metabolic City scores urban risk per H3 cell from mobility, climate and vulnerability data, so operators and field crews can see what changed and act on it.',
    canonical: '/',
    public: true,
    image: '/icon-512.png',
    roles: null,
    nav: null,
  },
  {
    id: 'login',
    path: '/login',
    title: 'Sign in | Metabolic City',
    description: 'Sign in to the Metabolic City operator console, field app and analytics.',
    canonical: '/login',
    public: true,
    image: '/icon-512.png',
    roles: null,
    nav: null,
  },
  {
    id: 'signup',
    path: '/signup',
    title: 'Create account | Metabolic City',
    description: 'Create a Metabolic City account for your municipality.',
    canonical: '/signup',
    public: true,
    image: '/icon-512.png',
    roles: null,
    nav: null,
  },
  {
    id: 'citizen-report',
    path: '/citizen-report',
    title: 'Report an issue | Metabolic City',
    description: 'Report a problem in your area to the city. No account is needed.',
    canonical: '/citizen-report',
    public: true,
    image: '/icon-512.png',
    roles: null,
    nav: null,
  },
  {
    id: 'operator',
    path: '/operator',
    title: 'Operator console | Metabolic City',
    public: false,
    roles: [ROLES.OPERATOR],
    nav: 'Operator',
  },
  {
    id: 'field',
    path: '/field',
    title: 'Field tasks | Metabolic City',
    public: false,
    roles: [ROLES.FIELD_CREW],
    nav: 'Field crew',
  },
  {
    id: 'field-task',
    path: '/field/tasks/:id',
    title: 'Task | Metabolic City',
    public: false,
    roles: [ROLES.FIELD_CREW],
    nav: null,
    hidden: true,
  },
  {
    id: 'admin',
    path: '/admin',
    title: 'Administration | Metabolic City',
    public: false,
    roles: [ROLES.ADMINISTRATOR],
    nav: 'Administration',
  },
  {
    id: 'analytics',
    path: '/analytics',
    title: 'Analytics | Metabolic City',
    public: false,
    roles: [ROLES.OPERATOR, ROLES.ADMINISTRATOR],
    nav: 'Analytics',
  },
  {
    id: 'unauthorized',
    path: '/unauthorized',
    title: 'Access denied | Metabolic City',
    description: 'Your role does not have access to that area of Metabolic City.',
    canonical: '/unauthorized',
    public: false,
    roles: null,
    nav: null,
  },
  {
    id: 'not-found',
    path: '*',
    title: 'Page not found | Metabolic City',
    description: 'That page does not exist in Metabolic City.',
    public: false,
    roles: null,
    nav: null,
  },
];

export const getRoute = (id) => ROUTES.find((route) => route.id === id);

export const canAccess = (route, role) => {
  if (!route || route.public || !route.roles) return true;
  const normalized = normalizeRole(role);
  return Boolean(normalized && route.roles.includes(normalized));
};

/** Navigation entries a role is allowed to open — derived from the guards. */
export const getNavItems = (role) => {
  const normalized = normalizeRole(role);
  if (!normalized) return [];
  return ROUTES.filter((route) => route.nav && route.roles?.includes(normalized));
};

/** Same-origin relative paths only, so `returnTo` can never redirect off-site. */
export const safeReturnTo = (value) => {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.startsWith('/login') || value.startsWith('/signup')) return null;
  return value;
};
