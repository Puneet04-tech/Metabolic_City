import { useCallback, useEffect, useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import Badge from '../ui/Badge/Badge';
import Button from '../ui/Button/Button';
import DataTable from '../ui/DataTable/DataTable';
import ErrorState from '../ui/ErrorState/ErrorState';
import Notice from '../ui/Notice/Notice';
import SearchInput from '../ui/SearchInput/SearchInput';
import Select from '../ui/Select/Select';
import Skeleton from '../ui/Skeleton/Skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu/DropdownMenu';
import { Dialog, DialogContent } from '../ui/Dialog/Dialog';
import { useToast } from '../ui/Toast/Toast';
import { apiRequest } from '../../api.js';
import { ROLE_LABELS, normalizeRole } from '../../lib/roles.js';
import styles from './UsersPanel.module.css';

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'operator', label: ROLE_LABELS.operator },
  { value: 'field_crew', label: ROLE_LABELS.field_crew },
  { value: 'administrator', label: ROLE_LABELS.administrator },
];

export default function UsersPanel() {
  const { push } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/v1/admin/users');
      setUsers(data.users || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (role !== 'all' && normalizeRole(user.role) !== role) return false;
      if (!query) return true;
      return [user.name, user.email, user.staffId, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [users, search, role]);

  const setActive = useCallback(
    async (user, active) => {
      setPending(null);
      try {
        await apiRequest(`/v1/admin/users/${user._id}/active`, { method: 'PATCH', body: { active } });
        setUsers((current) => current.map((item) => (item._id === user._id ? { ...item, active } : item)));
        push(active ? `${user.name} can sign in again.` : `${user.name} can no longer sign in.`, 'success');
      } catch (requestError) {
        push(requestError.message, 'error');
      }
    },
    [push]
  );

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <span className={styles.name}>
          <span className={styles.nameText}>{row.name || 'Unnamed user'}</span>
          <span className={styles.nameMeta}>{row.email || row.staffId || row.phone || '—'}</span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (row) => <Badge tone="accent">{ROLE_LABELS[normalizeRole(row.role)] || row.role}</Badge>,
    },
    { key: 'cityCode', header: 'City', sortable: true },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.active === false ? 'muted' : 'neutral'}>
          {row.active === false ? 'Deactivated' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Actions for ${row.name || 'user'}`}>
              <MoreHorizontal size={15} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {row.active === false ? (
              <DropdownMenuItem onSelect={() => setActive(row, true)}>Allow sign in</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setPending(row)}>Deactivate access</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <section className={styles.panel} aria-label="Users">
      <header className={styles.header}>
        <h2 className={styles.title}>Users</h2>
        <p className={styles.description}>
          People who can sign in to this municipality. Deactivating a user keeps their history but blocks sign in.
        </p>
      </header>

      <div className={styles.toolbar}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email or id"
          aria-label="Search users"
        />
        <Select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filter by role">
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className={styles.count}>
          {filtered.length} of {users.length} users
        </p>
      </div>

      {error ? <ErrorState title="The users could not be loaded" description={error} onRetry={load} /> : null}

      {loading ? (
        <Skeleton height={220} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(row) => row._id}
          pageSize={10}
          caption="Municipal users"
          empty={
            <Notice tone="info" title="No users match">
              Clear the search or the role filter to see the rest of the list.
            </Notice>
          }
        />
      )}

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent
          title="Deactivate this account?"
          description={`${pending?.name || 'This user'} will not be able to sign in. Their past decisions stay in the audit trail.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Keep access
              </Button>
              <Button variant="destructive" onClick={() => setActive(pending, false)}>
                Deactivate
              </Button>
            </>
          }
        >
          <p className={styles.confirmText}>This can be reversed at any time from the same menu.</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
