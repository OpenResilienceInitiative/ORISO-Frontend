import React, { useLayoutEffect, useRef, type PropsWithChildren } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PracticeSandboxSlot } from './PracticeSandboxSlot';
import { usePractice } from './PracticeProvider';
import { holdPracticeExit } from './practiceMode';
import { addressesPracticeCase, addressesRealCase } from './practiceRouteGuard';
import { PRACTICE_ENQUIRIES_ROUTE } from './practiceRoutes';

/**
 * Wraps the routed content of the authenticated shell:
 * - inactive: `children` untouched (a practice case route goes to the list);
 * - active: `children` inside the sandbox slot, on the practice world (a real
 *   case route goes to the practice enquiries);
 * - closing: nothing, so no real view mounts while the guard is still on and
 *   the practice views drain; back to where practice was started.
 * The subtree remounts at every switch: that is what moves the real session
 * views onto the practice world and back.
 */
export const PracticeSurface = ({ children }: PropsWithChildren) => {
	const { state } = usePractice();
	const location = useLocation();
	const navigate = useNavigate();
	const here = location.pathname + location.search;
	const startedAt = useRef<string | null>(null);
	// The router commits navigations as transitions: the guard stays on until
	// the way back has landed, so no real view mounts on a practice route.
	const returning = useRef<(() => void) | null>(null);

	useLayoutEffect(() => {
		if (state === 'active' && startedAt.current === null) {
			startedAt.current = here;
		}
		if (
			state === 'closing' &&
			startedAt.current !== null &&
			here !== startedAt.current
		) {
			returning.current ??= holdPracticeExit();
			navigate(startedAt.current, { replace: true });
		}
		if (state === 'inactive') {
			startedAt.current = null;
		}
		// Only the switch matters, not the navigation inside practice.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state]);

	useLayoutEffect(() => {
		if (
			returning.current &&
			(state !== 'closing' || here === startedAt.current)
		) {
			returning.current();
			returning.current = null;
		}
	}, [state, here]);

	useLayoutEffect(
		() => () => {
			returning.current?.();
		},
		[]
	);

	if (state === 'closing') {
		return null;
	}
	if (state === 'active') {
		return addressesRealCase(location.pathname) ? (
			<Navigate to={PRACTICE_ENQUIRIES_ROUTE} replace />
		) : (
			<PracticeSandboxSlot>{children}</PracticeSandboxSlot>
		);
	}
	return addressesPracticeCase(location.pathname) ? (
		<Navigate to={PRACTICE_ENQUIRIES_ROUTE} replace />
	) : (
		<>{children}</>
	);
};
