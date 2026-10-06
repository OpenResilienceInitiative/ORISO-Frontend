import * as React from 'react';
import './dragHandle.styles.scss';

export interface DragHandleProps {
	onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
	/** Pointer is currently resizing — darkens the pill (Figma Handle Touched). */
	touched?: boolean;
	/**
	 * Where the pill sits (T31): `inside` — 4 px under the card's top edge
	 * (desktop, the docked composer); `edge` — centred ON the top edge, the
	 * phone's earlier placement. A prop so it can move when Frank decides.
	 */
	position?: 'inside' | 'edge';
	ariaLabel: string;
}

/**
 * Composer drag handle — Figma node 18:1989 / 1168:38118. A 57×4 pill in
 * primary-fixed-dim sitting top-center on the outer container edge, inside a
 * 16px touch zone (widened for pointer targets). While touched it darkens to
 * on-primary-fixed-variant and grows slightly.
 */
export const DragHandle = ({
	onPointerDown,
	onKeyDown,
	touched = false,
	position = 'inside',
	ariaLabel
}: DragHandleProps) => (
	<button
		type="button"
		className={[
			'dragHandle',
			`dragHandle--${position}`,
			touched && 'dragHandle--touched'
		]
			.filter(Boolean)
			.join(' ')}
		data-position={position}
		onPointerDown={onPointerDown}
		onKeyDown={onKeyDown}
		aria-label={ariaLabel}
	>
		<span className="dragHandle__pill" aria-hidden />
	</button>
);
