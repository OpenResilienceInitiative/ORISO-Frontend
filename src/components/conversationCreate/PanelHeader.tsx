import * as React from 'react';
import { ReactComponent as PlusIcon } from '../../resources/img/icons/plus-mui.svg';
import { ReactComponent as MoreIcon } from '../../resources/img/icons/stack-vertical.svg';

/**
 * Panel header of the create flow (Figma 8482-30551 / 8482-30552):
 * a filled ⊕ badge, the panel title, and an outlined overflow button on the
 * right. Screen 2 renders the overflow disabled ("set this more vertical menu
 * to disabled") — it stays visible rather than disappearing, per the ORISO
 * "disable, don't hide" rule.
 */

interface PanelHeaderProps {
	title: string;
	menuLabel: string;
	menuDisabled?: boolean;
	onMenuClick?: () => void;
}

export const PanelHeader = ({
	title,
	menuLabel,
	menuDisabled = false,
	onMenuClick
}: PanelHeaderProps) => (
	<header className="conversationCreate__panelHeader">
		<span className="conversationCreate__panelBadge" aria-hidden>
			<PlusIcon />
		</span>
		<h2 className="conversationCreate__panelTitle">{title}</h2>
		<button
			type="button"
			className="conversationCreate__panelMenu"
			aria-label={menuLabel}
			disabled={menuDisabled}
			onClick={onMenuClick}
		>
			<MoreIcon aria-hidden />
		</button>
	</header>
);
