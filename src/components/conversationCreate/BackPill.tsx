import * as React from 'react';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';

/**
 * Full-width back control at the foot of the flow (Figma 8482-30552,
 * annotation "display the backbutton until one can write again"). The design
 * shows it on the mobile frames; it is rendered on desktop as well so the
 * counsellor is never trapped in the flow.
 */

interface BackPillProps {
	label: string;
	onClick: () => void;
}

export const BackPill = ({ label, onClick }: BackPillProps) => (
	<button
		type="button"
		className="conversationCreate__backPill"
		onClick={onClick}
		aria-label={label}
	>
		<BackIcon aria-hidden />
	</button>
);
