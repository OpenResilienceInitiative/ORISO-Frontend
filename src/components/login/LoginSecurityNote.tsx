import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LockIcon } from '../../resources/img/icons/lock.svg';

export interface LoginSecurityNoteProps {
	/** `compact` is the mobile sheet's shorter wording. */
	variant?: 'default' | 'compact';
}

/**
 * The end-to-end encryption note under the login form.
 *
 * It replaces the emerald `loginForm__securityBanner`, which was the only
 * foreign colour on the page — a green alert box for something that is not an
 * alert. This is a quiet line in the page's own neutrals.
 *
 * The design pairs it with a "Warum das extra sicher ist" link that opens the
 * explainer card. That card is
 * [#991](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/991);
 * until it exists the line carries no link, because a link to nothing is worse
 * than no link.
 */
export const LoginSecurityNote = ({
	variant = 'default'
}: LoginSecurityNoteProps) => {
	const { t: translate } = useTranslation();
	const compact = variant === 'compact';

	return (
		<Box
			className="loginForm__securityNote"
			sx={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: compact ? '7px' : '8px',
				mt: compact ? '20px' : '18px',
				p: compact ? '10px' : '8px',
				borderRadius: '12px',
				color: 'var(--m3-on-surface-variant, #444748)'
			}}
		>
			<Box
				aria-hidden
				sx={{
					'display': 'flex',
					'flex': 'none',
					'opacity': 0.55,
					'& svg': {
						width: compact ? 13 : 15,
						height: compact ? 13 : 15
					}
				}}
			>
				<LockIcon />
			</Box>
			{/* Typography never inherits the surrounding colour — it resolves to
			    text.primary — so the line states its own. */}
			<Typography
				component="span"
				sx={{
					fontSize: compact ? 12 : 13.5,
					lineHeight: 1.4,
					color: 'inherit'
				}}
			>
				{translate(
					compact
						? 'login.security.teaserShort'
						: 'login.security.teaser'
				)}
			</Typography>
		</Box>
	);
};
