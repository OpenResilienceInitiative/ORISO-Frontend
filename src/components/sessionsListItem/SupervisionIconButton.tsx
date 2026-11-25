import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SupervisionIcon } from '../../resources/img/icons/supervision_circ_400_24px.svg';
import '../teamDiscussion/teamDiscussion.styles.scss';

interface SupervisionIconButtonProps {
	/** Who supervises the case; shown on hover and read as the name. */
	supervisorNames: string[];
	/** Opens the Supervision side panel; the icon is a button only when given. */
	onOpen?: () => void;
}

/**
 * ORISO-Frontend#2494 (Frank, 24 Nov): the supervised-case marker in a list
 * row is one 32px round icon, like the Team-Besprechung icon next to it
 * (`TeamDiscussionIconButton`). Hover shows "Supervision: <Name>", a click
 * opens the Supervision side panel — big enough to hit on a phone, so the
 * word "Supervision" is not needed in the row.
 */
export const SupervisionIconButton = ({
	supervisorNames,
	onOpen
}: SupervisionIconButtonProps) => {
	const { t: translate } = useTranslation();
	const label = translate('sessionList.supervision.supervisedBy', {
		name: supervisorNames.join(', ')
	});
	return (
		<button
			type="button"
			className="teamDiscussionBadge teamDiscussionBadge--supervision"
			data-testid="supervision-indicator"
			data-tour-target="session-supervision-indicator"
			title={label}
			aria-label={label}
			aria-disabled={!onOpen || undefined}
			onKeyDown={(event) => {
				// Enter/Space activate this button, not the enclosing list row.
				if (event.key === 'Enter' || event.key === ' ') {
					event.stopPropagation();
				}
			}}
			onClick={(event) => {
				// The list row is itself clickable: do not also open the chat.
				event.stopPropagation();
				onOpen?.();
			}}
		>
			<SupervisionIcon aria-hidden="true" focusable="false" />
		</button>
	);
};
