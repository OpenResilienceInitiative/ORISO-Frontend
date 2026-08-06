import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { HandoverCarousel } from './HandoverCarousel';
import { HandoverGateButton } from './HandoverGateButton';
import { HandoverGateState } from './handoverGate';
import { useDeferredFlourish } from './useDeferredFlourish';

/** After this the gate opens regardless, labelled honestly as "taking longer". */
const SLOW_AFTER_MS = 20000;

export interface RegistrationHandoverProps {
	/** The real "everything behind the gate has loaded" signal (appReady). */
	ready: boolean;
	/** Called when the user opens the gate. Must land them in the message field. */
	onEnter: () => void;
	/** Test seam: force a gate state instead of deriving it from `ready`. */
	forcedState?: HandoverGateState;
}

/**
 * Post-registration handover screen. Replaces the old progress-bar loader.
 *
 * While the app bootstraps, the user reads what happens next instead of
 * watching a bar. The button underneath is the gate: it only opens once
 * everything behind it is loaded, so the click lands them in a chat room they
 * can type into immediately.
 *
 * Loading priority (Frank, 2026-08-06):
 *   tier 1  this markup — no network, painted on the first frame
 *   tier 2  the three card motifs — lazy, boxes reserved, no reflow
 *   tier 3  decoration — see `useDeferredFlourish`, never before tiers 1–2
 */
export const RegistrationHandover = ({
	ready,
	onEnter,
	forcedState
}: RegistrationHandoverProps) => {
	const { t } = useTranslation();
	const [slow, setSlow] = useState(false);
	const [artworkSettled, setArtworkSettled] = useState(false);
	const [entering, setEntering] = useState(false);
	const enteredRef = useRef(false);

	useEffect(() => {
		const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
		return () => clearTimeout(timer);
	}, []);

	const state: HandoverGateState =
		forcedState ??
		(entering
			? 'entering'
			: ready
				? 'ready'
				: slow
					? 'slow'
					: 'preparing');

	// Tier 3 waits for both: the content the user came for, and the app behind
	// the gate. Decoration must never compete with either.
	const flourish = useDeferredFlourish(artworkSettled && ready);

	const handleEnter = useCallback(() => {
		if (enteredRef.current) {
			return;
		}
		enteredRef.current = true;
		setEntering(true);
		onEnter();
	}, [onEnter]);

	return (
		<Box
			data-cy="registration-handover"
			data-cy-flourish={flourish ? 'on' : 'off'}
			sx={{
				position: 'fixed',
				inset: 0,
				zIndex: (theme) => theme.zIndex.modal,
				display: 'flex',
				flexDirection: 'column',
				bgcolor: registrationMd3.surface,
				color: registrationMd3.onSurface,
				overflow: 'hidden'
			}}
		>
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column',
					width: '100%',
					maxWidth: { xs: '100%', sm: 720 },
					mx: 'auto',
					px: { xs: 2.5, sm: 5 },
					pt: { xs: 3, sm: 4 }
				}}
			>
				<Box sx={{ flex: 'none' }}>
					<Box
						component="span"
						data-cy="handover-badge"
						sx={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 1,
							height: 30,
							pl: 0.5,
							pr: 1.5,
							mb: 1.25,
							borderRadius: '15px',
							bgcolor: registrationMd3.surfaceContainer
						}}
					>
						<Box
							component="span"
							aria-hidden
							sx={{
								width: 22,
								height: 22,
								borderRadius: '50%',
								bgcolor: registrationMd3.primary,
								color: registrationMd3.onPrimary,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								'& svg': { fontSize: 14 }
							}}
						>
							<CheckRoundedIcon />
						</Box>
						<Typography
							component="span"
							sx={{
								fontSize: 12,
								fontWeight: 600,
								letterSpacing: '0.6px',
								textTransform: 'uppercase',
								color: registrationMd3.primary
							}}
						>
							{t('registration.handover.badge', 'Registriert')}
						</Typography>
					</Box>
					<Typography
						component="h1"
						sx={{
							fontSize: { xs: 30, sm: 34 },
							lineHeight: { xs: '36px', sm: '41px' },
							fontWeight: 700
						}}
					>
						{t('registration.handover.headline', 'Geschafft.')}
					</Typography>
					<Typography
						sx={{
							mt: 0.75,
							fontSize: { xs: 15, sm: 16 },
							lineHeight: { xs: '21px', sm: '22px' },
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{t(
							'registration.handover.subline',
							'So geht es weiter:'
						)}
					</Typography>
				</Box>

				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column',
						pt: { xs: 2.25, sm: 2.5 }
					}}
				>
					<HandoverCarousel
						onArtworkSettled={() => setArtworkSettled(true)}
					/>
				</Box>

				<Box
					sx={{
						flex: 'none',
						display: 'flex',
						alignItems: 'flex-start',
						justifyContent: { xs: 'flex-start', sm: 'center' },
						gap: 1.25,
						py: { xs: 1.5, sm: 2 },
						fontSize: { xs: 12, sm: 13 },
						lineHeight: { xs: '17px', sm: '18px' },
						color: registrationMd3.onSurfaceVariant,
						textAlign: { xs: 'left', sm: 'center' }
					}}
				>
					<LockOutlinedIcon
						aria-hidden
						sx={{ fontSize: 18, flexShrink: 0, mt: '1px' }}
					/>
					<Typography component="span" sx={{ fontSize: 'inherit' }}>
						{t(
							'registration.handover.encryption',
							'Verschlüsselt: Nur Sie und die Mitarbeiterinnen Ihrer Beratungsstelle können Ihre Anfrage einsehen.'
						)}
					</Typography>
				</Box>
			</Box>

			<Box
				sx={{
					flex: 'none',
					bgcolor: '#fff',
					borderTop: `1px solid ${registrationMd3.outlineVariant}`,
					px: { xs: 2, sm: 5 },
					pt: 1.25,
					pb: 1.75
				}}
			>
				<Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
					<HandoverGateButton state={state} onEnter={handleEnter} />
				</Box>
			</Box>
		</Box>
	);
};
