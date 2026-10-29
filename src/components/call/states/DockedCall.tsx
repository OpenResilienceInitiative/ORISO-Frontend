import React, { useEffect, useState } from 'react';
import {
	MinimizedCallDock,
	type MinimizedCallDockProps
} from './MinimizedCallDock';

export type DockedCallProps = Omit<MinimizedCallDockProps, 'elapsedSeconds'> & {
	/** When the call connected, in ms since the epoch. */
	startedAt: number;
};

/**
 * The dock with its own clock: only this re-renders every second, not the
 * widget that holds the call's iframe.
 */
export const DockedCall: React.FC<DockedCallProps> = ({
	startedAt,
	...dock
}) => {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);
	return (
		<MinimizedCallDock
			{...dock}
			elapsedSeconds={Math.max(0, Math.floor((now - startedAt) / 1000))}
		/>
	);
};
