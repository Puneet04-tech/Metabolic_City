# Frontend Refactoring Plan

## Current Status
- Created folder structure: `components/HomePage`, `components/Auth`, `components/Operator`, `components/Field`, `components/Admin`, `components/Analytics`, `components/Shared`
- Created components:
  - `ProductShell.jsx` - Shared navigation shell
  - `HomePage.jsx` - Landing page
  - `AuthForm.jsx` - Login/Signup form
  - `H3Map.jsx` - Map component
  - `LiveCells.jsx` - Cell grid component
  - `OperatorConsole.jsx` - Operator console page

## Remaining Components to Create
1. **Field Console** (`components/Field/FieldConsole.jsx`)
   - TaskCard component
   - Field console main logic

2. **Admin Console** (`components/Admin/AdminConsole.jsx`)
   - Weight configuration
   - User management
   - Audit logs

3. **Analytics** (`components/Analytics/Analytics.jsx`)
   - Metrics display
   - Incident filtering
   - CSV export

4. **Shared Components**
   - RoleHome redirect component
   - RequireAuth wrapper

## Next Steps
1. Create remaining components
2. Update `App.jsx` to import from new structure
3. Update imports in all components
4. Test all routes
5. Commit changes
