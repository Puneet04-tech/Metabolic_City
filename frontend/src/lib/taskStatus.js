/** The server's task statuses and the labels the crew sees. */
export const TASK_STATUSES = {
  APPROVED: { label: 'Assigned', step: 0 },
  DISPATCHED: { label: 'Assigned', step: 0 },
  ACKNOWLEDGED: { label: 'Accepted', step: 1 },
  ARRIVED: { label: 'On site', step: 2 },
  RESOLVED: { label: 'Resolved', step: 3 },
};

export const TASK_STEPS = [
  { key: 'assigned', label: 'Assigned', status: 'APPROVED' },
  { key: 'accepted', label: 'Accepted', status: 'ACKNOWLEDGED' },
  { key: 'onSite', label: 'On site', status: 'ARRIVED' },
  { key: 'resolved', label: 'Resolved', status: 'RESOLVED' },
];

/** The status to send for the next action from the current one. */
export const nextStatusFor = (status) => {
  if (status === 'APPROVED' || status === 'DISPATCHED') return 'ACKNOWLEDGED';
  if (status === 'ACKNOWLEDGED') return 'ARRIVED';
  if (status === 'ARRIVED') return 'RESOLVED';
  return null;
};

/** The label of the primary action for the current status. */
export const actionLabelFor = (status) => {
  if (status === 'APPROVED' || status === 'DISPATCHED') return 'Accept task';
  if (status === 'ACKNOWLEDGED') return "I'm on site";
  if (status === 'ARRIVED') return 'Resolve task';
  return null;
};

/** The incident priority mapped onto the product's severity scale. */
export const prioritySeverity = (priority) => {
  const value = (priority || '').toUpperCase();
  if (value === 'CRITICAL') return 'critical';
  if (value === 'HIGH') return 'caution';
  if (value === 'MODERATE' || value === 'LOW') return 'normal';
  return 'normal';
};

export const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
