import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import RequireAuth from './RequireAuth';
import useDocumentMeta from './lib/useDocumentMeta.js';
import { getRoute } from './lib/routes.js';
import HomePage from './components/HomePage/HomePage.jsx';
import NotFound from './pages/NotFound.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import Spinner from './components/ui/Spinner/Spinner.jsx';
import RouteFallback from './components/system/RouteFallback.jsx';

// Route-level code splitting: each surface is fetched when it is first opened.
const AuthForm = lazy(() => import('./components/Auth/AuthForm.jsx'));
const OperatorConsole = lazy(() => import('./components/Operator/OperatorConsole.jsx'));
const FieldConsole = lazy(() => import('./components/Field/FieldConsole.jsx'));
const AdminConsole = lazy(() => import('./components/Admin/AdminConsole.jsx'));
const Analytics = lazy(() => import('./components/Analytics/Analytics.jsx'));
const RoleHome = lazy(() => import('./components/Shared/RoleHome.jsx'));
const CitizenReport = lazy(() => import('./components/Citizen/CitizenReport.jsx'));
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
        <Route path="/" element={withFrame('home', <HomePage />)} />
        <Route path="/login" element={withFrame('login', <AuthForm mode="login" />)} />
        <Route path="/signup" element={withFrame('signup', <AuthForm mode="signup" />)} />
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
              {withFrame('field', <FieldConsole />)}
            </RequireAuth>
          }
        />
        <Route
          path="/field/tasks/:id"
          element={
            <RequireAuth routeId="field-task">
              {withFrame('field-task', <FieldConsole />)}
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
    </ErrorBoundary>
  );
}
