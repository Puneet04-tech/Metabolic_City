import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import RequireAuth from './RequireAuth';
import useDocumentMeta from './lib/useDocumentMeta.js';
import { getRoute } from './lib/routes.js';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import SessionGuard from './components/session/SessionGuard.jsx';
import RouteFallback from './components/system/RouteFallback.jsx';

// Route-level code splitting: each surface is fetched when it is first opened.
const SignIn = lazy(() => import('./pages/SignIn.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const OperatorConsole = lazy(() => import('./pages/OperatorConsole.jsx'));
const FieldTasks = lazy(() => import('./pages/FieldTasks.jsx'));
const FieldTaskDetail = lazy(() => import('./pages/FieldTaskDetail.jsx'));
const AdminConsole = lazy(() => import('./components/Admin/AdminConsole.jsx'));
const Analytics = lazy(() => import('./components/Analytics/Analytics.jsx'));
const RoleHome = lazy(() => import('./components/Shared/RoleHome.jsx'));
const CitizenReport = lazy(() => import('./pages/CitizenReport.jsx'));
const Gallery = import.meta.env.DEV ? lazy(() => import('./components/gallery/Gallery.jsx')) : null;

/**
 * Sets the document title and the robots directive for a route.
 */
function RouteFrame({ routeId, children }) {
  const route = getRoute(routeId);
  useDocumentMeta(route?.title, { noindex: route ? !route.public : false });
  return children;
}

const withFrame = (routeId, element) => <RouteFrame routeId={routeId}>{element}</RouteFrame>;

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={<RouteFallback />}
      >
        <Routes>
        <Route path="/" element={withFrame('home', <Landing />)} />
        <Route path="/login" element={withFrame('login', <SignIn />)} />
        <Route path="/signup" element={withFrame('signup', <SignUp />)} />
        <Route path="/citizen-report" element={withFrame('citizen-report', <CitizenReport />)} />
        <Route path="/role-home" element={withFrame('home', <RoleHome />)} />

        <Route
          path="/operator"
          element={
            <RequireAuth routeId="operator">
              {withFrame('operator', <OperatorConsole />)}
            </RequireAuth>
          }
        />
        <Route
          path="/field"
          element={
            <RequireAuth routeId="field">
              {withFrame('field', <FieldTasks />)}
            </RequireAuth>
          }
        />
        <Route
          path="/field/tasks/:id"
          element={
            <RequireAuth routeId="field-task">
              {withFrame('field-task', <FieldTaskDetail />)}
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth routeId="admin">
              {withFrame('admin', <AdminConsole />)}
            </RequireAuth>
          }
        />
        <Route
          path="/analytics"
          element={
            <RequireAuth routeId="analytics">
              {withFrame('analytics', <Analytics />)}
            </RequireAuth>
          }
        />

        <Route path="/unauthorized" element={withFrame('unauthorized', <Unauthorized />)} />
        <Route path="*" element={withFrame('not-found', <NotFound />)} />

        {import.meta.env.DEV && Gallery ? (
          <Route
            path="/__gallery"
            element={
              <RouteFrame routeId="not-found">
                <Gallery />
              </RouteFrame>
            }
          />
        ) : null}
        </Routes>
      </Suspense>
      <SessionGuard />
    </ErrorBoundary>
  );
}
