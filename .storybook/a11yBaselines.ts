import type { A11yBaselineEntry } from './a11yBaseline';

// Findings are not approvals. Each reviewed entry must name its exact story,
// environment, owner, tracking issue, expiry, and full violation multiset.
// Refreshing snapshots is never part of an ordinary test run.
export const approvedA11yBaselines: A11yBaselineEntry[] = [];
