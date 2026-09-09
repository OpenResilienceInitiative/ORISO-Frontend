import React from 'react';
import { createPortal } from 'react-dom';
import { useMenuEffects } from '../../features/menu-effects/useMenuEffects';

/** Decorative scrim; the menu remains responsible for keyboard/focus handling. */
export const MenuBackdrop = ({
	open,
	onClose,
	zIndex = 99998
}: {
	open: boolean;
	onClose: () => void;
	zIndex?: number;
}) => {
	const { enabled, motionEnabled } = useMenuEffects();
	if (!open || !enabled) return null;
	return createPortal(
		<div
			aria-hidden="true"
			className={`orisoMenuBackdrop${motionEnabled ? ' orisoMenuBackdrop--animated' : ''}`}
			style={{ zIndex }}
			onMouseDown={(event) => {
				event.stopPropagation();
				onClose();
			}}
		/>,
		document.body
	);
};
