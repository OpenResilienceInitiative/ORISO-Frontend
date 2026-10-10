import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { PracticeProvider } from './PracticeProvider';
import { PracticeHostHooks } from './practiceTourHostHooks';

/**
 * The practice area's footprint in the authenticated app: the provider (above
 * `Routing`, so navigation never remounts it, and its unmount ends practice
 * with logout) and the tour host hooks, registered once at app start.
 */
export const PracticeLayer = ({ children }: PropsWithChildren) => (
	<PracticeProvider>
		<PracticeHostHooks />
		{children}
	</PracticeProvider>
);
