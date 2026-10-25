import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { formatElapsed, useElapsed } from './GroupRunningNow';

export interface GroupRulesIntroProps {
	rules: string[];
	/** The planned start; once it has passed the kicker says how long the group runs. */
	since: Date | null;
	nowMs?: number;
}

/**
 * The group's rules once, calmly, while the bar asks for consent on
 * "Beitreten" (Frank, 2026-10-19: "kurz die Liste der Verhaltensregeln …
 * ohne dass die eben rot sind"). Numbered grey cards, all at once: nothing
 * moves, nothing warns.
 */
export const GroupRulesIntro = ({
	rules,
	since,
	nowMs
}: GroupRulesIntroProps) => {
	const { t } = useTranslation();
	const elapsed = useElapsed(since, nowMs);

	return (
		<Box
			data-cy="group-rules-intro"
			sx={{
				display: 'flex',
				flexDirection: 'column',
				gap: { xs: 1.75, sm: 2.5 },
				width: '100%',
				maxWidth: 720,
				mx: 'auto'
			}}
		>
			<Box sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
				{elapsed !== null && elapsed >= 0 && (
					<Typography
						sx={{
							fontSize: 11,
							fontWeight: 600,
							letterSpacing: '1.4px',
							textTransform: 'uppercase',
							color: registrationMd3.onSurfaceVariant,
							fontVariantNumeric: 'tabular-nums'
						}}
					>
						{t('groupChat.entry.running.since', 'Läuft seit')}{' '}
						{formatElapsed(elapsed)}
					</Typography>
				)}
				<Typography
					component="h1"
					sx={{
						mt: 0.5,
						fontSize: { xs: 24, sm: 28 },
						lineHeight: 1.2,
						fontWeight: 700,
						color: registrationMd3.onSurface
					}}
				>
					{t(
						'groupChat.entry.rules.headline',
						'So gehen wir miteinander um'
					)}
				</Typography>
				<Typography
					sx={{
						mt: 0.75,
						fontSize: { xs: 15, sm: 16 },
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{t(
						'groupChat.entry.rules.subline',
						'Einmal kurz lesen – dann sind Sie dabei.'
					)}
				</Typography>
			</Box>
			<Box
				component="ol"
				aria-label={t(
					'groupChat.join.waitingArea.rulesLabel',
					'Chat rules'
				)}
				sx={{
					listStyle: 'none',
					m: 0,
					p: 0,
					display: 'grid',
					/* Two columns where a card still holds a sentence, one in
					   a phone or a narrow chat column. */
					gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
					gap: { xs: 1, sm: 1.5 }
				}}
			>
				{rules.map((rule, index) => (
					<Box
						component="li"
						key={`${index}-${rule}`}
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1.5,
							minHeight: { xs: 52, sm: 64 },
							px: 2,
							py: 1,
							borderRadius: '16px',
							bgcolor: registrationMd3.surfaceContainerLowest,
							border: `1px solid ${registrationMd3.surfaceContainerHigh}`
						}}
					>
						<Box
							aria-hidden
							sx={{
								width: 28,
								height: 28,
								flexShrink: 0,
								borderRadius: '50%',
								bgcolor: registrationMd3.surfaceContainerHigh,
								color: registrationMd3.onSurfaceVariant,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: 13,
								fontWeight: 700
							}}
						>
							{index + 1}
						</Box>
						<Typography
							sx={{
								fontSize: { xs: 15, sm: 16 },
								color: registrationMd3.onSurface,
								overflowWrap: 'anywhere'
							}}
						>
							{rule}
						</Typography>
					</Box>
				))}
			</Box>
		</Box>
	);
};
