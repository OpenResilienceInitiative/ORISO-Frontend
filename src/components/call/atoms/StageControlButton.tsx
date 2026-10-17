import * as React from 'react';

import styles from './stageControlButton.module.scss';

export interface StageControlButtonProps {
	/** The words. Both the tooltip and the accessible name. */
	readonly label: string;
	/** Inherited from the icon library — never drawn here. */
	readonly icon: React.ReactNode;
	readonly onClick: () => void;
	/** Set only when the control opens something. */
	readonly expanded?: boolean;
	readonly className?: string;
}

/**
 * A stage header control, ticket 05.
 *
 * "Header control is a 44 px icon-only button with a tooltip; no label."
 *
 * One `label` prop feeds both the tooltip and `aria-label`, deliberately: a
 * tooltip is for a mouse and nothing else. It never appears for a keyboard
 * user, screen readers treat bare `title` inconsistently, and on a phone
 * there is no hover at all. Taking one string and spending it twice is the
 * only way "icon-only with a tooltip" stays honest.
 *
 * The geometry — 44px, radius 22, white on a hairline — is the prototype's
 * for the atmosphere chooser, and the shape is generic enough that the other
 * header controls can use it rather than growing their own.
 */
export const StageControlButton = ({
	label,
	icon,
	onClick,
	expanded,
	className
}: StageControlButtonProps) => (
	<button
		// Never a submit: this lands in headers, and one of them will
		// eventually sit inside a form.
		type="button"
		className={[styles.control, className].filter(Boolean).join(' ')}
		title={label}
		aria-label={label}
		aria-expanded={expanded}
		onClick={onClick}
	>
		<span className={styles.glyph} aria-hidden="true">
			{icon}
		</span>
	</button>
);
