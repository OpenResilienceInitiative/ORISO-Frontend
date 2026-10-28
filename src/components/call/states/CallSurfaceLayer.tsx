import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * The layer the incoming-call card and the minimized dock live in.
 *
 * Portalled to `<body>`: a `transform`, `filter` or `contain` on any ancestor
 * turns `position: fixed` into "fixed to that ancestor", and the app shell
 * animates its panes with transforms. A call surface rendered in place would
 * be clipped by whichever pane happened to hold it.
 *
 * Its z-index sits above the app shell (MUI app bar 1100, drawer 1200) and
 * below system dialogs (MUI modal 1300, snackbar 1400), see `callStates.scss`.
 */
export const CallSurfaceLayer: React.FC<{
	children: React.ReactNode;
	className?: string;
}> = ({ children, className }) => {
	if (typeof document === 'undefined') return null;
	return createPortal(
		<div
			className={`call-surface-layer${className ? ` ${className}` : ''}`}
			data-testid="call-surface-layer"
		>
			{children}
		</div>,
		document.body
	);
};
