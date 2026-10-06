import React, { type PropsWithChildren } from 'react';
import { PracticeSandboxSlot } from './PracticeSandboxSlot';
import { usePractice } from './PracticeProvider';

/**
 * Wraps the authenticated shell. Renders `children` untouched and, only while
 * practice mode is active, the sandbox slot beside them. It never wraps the
 * children in anything, so they keep their place in the tree (no remount)
 * when practice starts or ends.
 */
export const PracticeSurface = ({ children }: PropsWithChildren) => {
	const { isPractice } = usePractice();
	return (
		<>
			{children}
			{isPractice && <PracticeSandboxSlot />}
		</>
	);
};
