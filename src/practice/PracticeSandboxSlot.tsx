import React, { type PropsWithChildren } from 'react';

/**
 * INTEGRATION SEAM for S0's `PracticeSandbox` (fake REST backend, fake Matrix
 * service, fixtures). `PracticeSurface` renders the routed content inside
 * this slot while practice mode is active, and without it otherwise, so the
 * sandbox mounts after the guard is on and unmounts when practice ends.
 *
 * The integrator replaces the body with
 * `<PracticeSandbox counsellor={userData}>{children}</PracticeSandbox>`
 * (`counsellor` from `UserDataContext`); nothing else in the practice UI knows
 * about the sandbox. Until then it passes its children through.
 */
export const PracticeSandboxSlot = ({ children }: PropsWithChildren) => (
	<>{children}</>
);
