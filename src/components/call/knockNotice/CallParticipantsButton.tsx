import * as React from 'react';
import { Badge, IconButton } from '@mui/material';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import { useTranslation } from 'react-i18next';

export interface CallParticipantsButtonProps {
	/** How many people are knocking (`useCallKnocks().people.length`). */
	waiting: number;
	onClick?: () => void;
}

/**
 * The participants icon of the call toolbar with a small count of the people
 * still knocking (#1892, FE#1794 §3). The count is in the button's name, so
 * a screen reader hears it; the badge itself is decoration.
 */
export const CallParticipantsButton = ({
	waiting,
	onClick
}: CallParticipantsButtonProps) => {
	const { t } = useTranslation();
	const label =
		waiting > 0
			? t('calls.knock.participantsWaiting', { count: waiting })
			: t('calls.knock.participants');

	return (
		<IconButton
			onClick={onClick}
			aria-label={label}
			data-testid="call-participants-button"
			sx={{
				'color': 'var(--m3-on-surface, #1d1b1c)',
				'width': 48,
				'height': 48,
				'&:focus-visible': {
					outline: '2px solid var(--m3-primary, #a3000f)',
					outlineOffset: 2
				}
			}}
		>
			<Badge
				badgeContent={waiting}
				max={99}
				invisible={waiting === 0}
				aria-hidden="true"
				data-testid="call-participants-badge"
				sx={{
					'& .MuiBadge-badge': {
						backgroundColor: 'var(--m3-error, #ba1a1a)',
						color: 'var(--m3-on-error, #ffffff)',
						fontSize: 11,
						fontWeight: 500,
						minWidth: 16,
						height: 16,
						px: 0.5
					}
				}}
			>
				<PeopleOutlinedIcon />
			</Badge>
		</IconButton>
	);
};
