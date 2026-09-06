import * as React from 'react';
import { Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import type { Pseudonym } from '../../../utils/anonName/engine';
import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';

export interface LiveChatAccessProps {
	pseudonym: Pseudonym;
	onReroll: () => void;
	onContinue: () => void;
	busy?: boolean;
}

/**
 * A — the door. A name for today, no password: an access that deletes itself
 * needs none (Frank, 2026-09-05). The sentence under the name says so.
 */
export const LiveChatAccess = ({
	pseudonym,
	onReroll,
	onContinue,
	busy = false
}: LiveChatAccessProps) => {
	const { t } = useTranslation();
	const tr = (key: string, fallback: string) =>
		translateWithFallback(t, `liveChat.entry.access.${key}`, fallback);
	return (
		<>
			<Box sx={{ mb: 3 }}>
				<Typography
					component="h1"
					sx={{
						fontSize: { xs: 30, sm: 34 },
						lineHeight: { xs: '36px', sm: '41px' },
						fontWeight: 700,
						color: registrationMd3.onSurface
					}}
				>
					{tr('headline', 'Ihr Name für heute.')}
				</Typography>
				<Typography
					sx={{
						mt: 0.75,
						fontSize: 16,
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{tr(
						'subline',
						'Anonym, ohne Konto. Würfeln Sie, bis er Ihnen gefällt.'
					)}
				</Typography>
			</Box>
			<Box
				data-cy="entry-room-pseudonym"
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2.5,
					p: 2.5,
					borderRadius: '20px',
					bgcolor: registrationMd3.surfaceContainer,
					maxWidth: 560
				}}
			>
				<Box sx={{ width: 72, height: 72, flexShrink: 0 }}>
					<AnimalAvatar avatar={pseudonym.avatar} size={72} />
				</Box>
				<Box sx={{ minWidth: 0 }}>
					<Typography
						sx={{
							fontSize: 11,
							fontWeight: 600,
							letterSpacing: '.12em',
							textTransform: 'uppercase',
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{tr('label', 'Ihr Pseudonym')}
					</Typography>
					<Typography
						sx={{ fontSize: 22, fontWeight: 700, mt: 0.25 }}
						aria-live="polite"
					>
						{pseudonym.displayName}
					</Typography>
				</Box>
			</Box>
			<Box
				sx={{
					display: 'flex',
					gap: 1.25,
					alignItems: 'flex-start',
					mt: 3,
					maxWidth: 560,
					fontSize: 13,
					lineHeight: '18px',
					color: registrationMd3.onSurfaceVariant
				}}
			>
				<LockOutlinedIcon
					aria-hidden
					sx={{ fontSize: 18, flexShrink: 0, mt: '1px' }}
				/>
				<Typography sx={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
					{tr(
						'temporary',
						'Dieser Zugang gilt nur für dieses Gespräch. Danach löschen wir ihn — samt aller Nachrichten, spätestens nach 48 Stunden. Bleiben Sie in diesem Fenster, bis Sie dran sind.'
					)}
				</Typography>
			</Box>
			<RegistrationFooter
				secondary={{
					label: tr('reroll', 'Neu würfeln'),
					onClick: onReroll,
					disabled: busy
				}}
				primary={{
					label: tr('continue', 'Zum Warteraum'),
					onClick: onContinue,
					disabled: busy
				}}
			/>
		</>
	);
};
