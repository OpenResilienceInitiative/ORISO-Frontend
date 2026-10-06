import React, { type PropsWithChildren } from 'react';
import { PracticeSandboxSlot } from './PracticeSandboxSlot';
import { usePractice } from './PracticeProvider';

/**
 * Wraps the routed content of the authenticated shell. Renders `children`
 * untouched while practice is off, and inside the sandbox slot while it is
 * on. The subtree remounts when practice starts or ends: that is what puts
 * the real session views onto the practice world and back.
 */
export const PracticeSurface = ({ children }: PropsWithChildren) => {
	const { isPractice } = usePractice();
	return isPractice ? (
		<PracticeSandboxSlot>{children}</PracticeSandboxSlot>
	) : (
		<>{children}</>
	);
};
