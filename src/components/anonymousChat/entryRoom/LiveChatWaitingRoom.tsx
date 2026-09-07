import * as React from 'react';
import { useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SentimentSatisfiedAltOutlinedIcon from '@mui/icons-material/SentimentSatisfiedAltOutlined';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import { HandoverGateButton } from '../../app/registrationLoader/HandoverGateButton';
import {
	HandoverCarousel,
	HandoverStep
} from '../../app/registrationLoader/HandoverCarousel';
import { BreathingCompanionHost } from '../../pseudonym/breathingCompanion/BreathingCompanionHost';
import { LeaveQueueDialog } from '../../pseudonym/LeaveQueueDialog';
import { sanitizeConsentHtml } from '../../legalContent/legalHtmlSanitizer';
import htmlParser from '../../../resources/scripts/util/htmlParser';
import { liveChatArtwork } from '../../../resources/img/registration-md3/registrationArtwork';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';

export interface LiveChatWaitingRoomProps {
	/** People ahead in the queue; `null` while unknown. */
	ahead: number | null;
	/** A counsellor has taken the conversation. */
	accepted: boolean;
	/** Who took it — shown once known, otherwise omitted. */
	counsellorLine?: string;
	/**
	 * The tenant's consent sentence as HTML (legal links inside). Rendered
	 * through the ADR-022 sanitizer, never raw.
	 */
	consentHtml: string;
	onAccept: () => void;
	/** The way out: finish the enquiry and delete the access. */
	onLeave: () => Promise<void> | void;
	/** Written alternative — the registration. */
	onMailCounselling: () => void;
	busy?: boolean;
	leaveFailed?: boolean;
	/** Storybook: open the companion at once. */
	companionStart?: boolean;
}

const CARD_KEYS = ['wait', 'consent', 'anonymous'] as const;

/** One dot per person ahead; a filled dot is someone who has been called. */
const QueueDots = ({ ahead, total }: { ahead: number; total: number }) => (
	<Box
		aria-hidden
		sx={{
			display: 'inline-flex',
			gap: 0.75,
			alignItems: 'center',
			mr: 1.5
		}}
	>
		{Array.from({ length: total }, (_, i) => (
			<Box
				key={i}
				sx={{
					width: 10,
					height: 10,
					borderRadius: '50%',
					bgcolor:
						i < total - ahead
							? registrationMd3.primary
							: registrationMd3.surfaceContainerHigh,
					transition: 'background-color 400ms ease'
				}}
			/>
		))}
	</Box>
);

/** The arrow's stand-in while the queue moves. */
const TurningClock = () => (
	<ScheduleOutlinedIcon
		sx={{
			'@keyframes liveChatTurn': { to: { transform: 'rotate(360deg)' } },
			'animation': 'liveChatTurn 6s linear infinite',
			'@media (prefers-reduced-motion: reduce)': { animation: 'none' }
		}}
	/>
);

/**
 * B — the waiting room. One page, three things change: the line under the
 * title, the middle, the bar. The bar is the loading bar; consent slides in
 * from below the moment a counsellor accepts, carrying the button that
 * starts the chat, with a round X beside it so nobody is left with one
 * choice (Frank, 2026-09-05).
 */
export const LiveChatWaitingRoom = ({
	ahead,
	accepted,
	counsellorLine,
	consentHtml,
	onAccept,
	onLeave,
	onMailCounselling,
	busy = false,
	leaveFailed = false,
	companionStart = false
}: LiveChatWaitingRoomProps) => {
	const { t } = useTranslation();
	const tr = (
		key: string,
		fallback: string,
		options?: Record<string, unknown>
	) =>
		translateWithFallback(
			t,
			`liveChat.entry.waiting.${key}`,
			fallback,
			options
		);
	const [leaving, setLeaving] = useState(false);
	const [companion, setCompanion] = useState(companionStart);
	/* The contract: when counselling starts, unmount. Accepted wins over
	   whatever the person was doing — the breathing companion included. */
	const companionOpen = companion && !accepted;
	const total = Math.max(5, ahead ?? 0);
	/* Capped like `handoverGate.ts` does with `slow: 90`: being next in line
	   is not being connected, and a full bar would say it is. */
	const progress =
		ahead === null
			? 20
			: Math.min(90, Math.round(((total - ahead) / total) * 100));

	const cards: HandoverStep[] = CARD_KEYS.map((key) => ({
		key: `live-${key}`,
		artwork: liveChatArtwork[key],
		titleKey: `liveChat.entry.steps.${key}.title`,
		textKey: `liveChat.entry.steps.${key}.text`,
		titleFallback: {
			wait: 'Sie warten, bis jemand frei ist',
			consent: 'Dann stimmen Sie einmal zu',
			anonymous: 'Anonym, und danach weg'
		}[key],
		textFallback: {
			wait: 'Die Beraterinnen sind gerade in anderen Gesprächen.',
			consent:
				'Sobald eine Stelle Ihr Gespräch annimmt, sehen Sie ihren Datenschutz.',
			anonymous:
				'Nur Ihr Pseudonym ist sichtbar. Nach 48 Stunden ist alles gelöscht.'
		}[key]
	}));

	const aheadLine =
		ahead === null
			? tr('aheadUnknown', 'Wir suchen eine freie Beraterin für Sie.')
			: ahead === 0
				? tr('aheadNone', 'Sie sind die Nächste.')
				: ahead === 1
					? tr('aheadOne', 'Eine Person vor Ihnen')
					: tr('aheadMany', `${ahead} Personen vor Ihnen`, {
							count: ahead
						});

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
					{tr('headline', 'Gleich geht es los.')}
				</Typography>
				<Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
					{!accepted && ahead !== null && (
						<QueueDots ahead={ahead} total={total} />
					)}
					<Typography
						role="status"
						aria-live="polite"
						sx={{
							fontSize: 16,
							fontWeight: accepted ? 700 : 400,
							color: accepted
								? registrationMd3.primary
								: registrationMd3.onSurfaceVariant
						}}
					>
						{accepted
							? tr('accepted', 'Eine Beraterin ist da.')
							: aheadLine}
					</Typography>
				</Box>
			</Box>

			{companionOpen ? (
				<BreathingCompanionHost onClose={() => setCompanion(false)} />
			) : (
				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column',
						mx: { xs: -2.5, sm: 0 }
					}}
				>
					<HandoverCarousel
						steps={cards}
						cardWidth={{ xs: 300, sm: 372 }}
					/>
				</Box>
			)}

			{!accepted && !companionOpen && (
				<Box
					sx={{
						mt: 1.5,
						mb: -1,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: 2,
						flexWrap: 'wrap'
					}}
				>
					<ButtonBase
						onClick={() => setCompanion(true)}
						sx={{
							'display': 'flex',
							'alignItems': 'center',
							'gap': 1.5,
							'px': 2,
							'py': 1.25,
							'borderRadius': '999px',
							'bgcolor': registrationMd3.surfaceContainer,
							'fontSize': 14,
							'& svg': { color: registrationMd3.primary }
						}}
					>
						<SentimentSatisfiedAltOutlinedIcon />
						{tr('companion', 'Ruhige Begleitung, bis es losgeht')}
					</ButtonBase>
					<ButtonBase
						onClick={onMailCounselling}
						sx={{
							fontSize: 14,
							color: registrationMd3.onSurfaceVariant,
							textAlign: 'left'
						}}
					>
						{tr(
							'mail',
							'Lieber schreiben statt warten? Zur Mail-Beratung →'
						)}
					</ButtonBase>
				</Box>
			)}

			{!accepted && (
				<RegistrationFooter>
					<Box sx={{ width: '100%' }}>
						<HandoverGateButton
							state="queued"
							onEnter={() => undefined}
							label={tr('bar', 'Warteraum')}
							status={
								ahead === null
									? tr(
											'barStatusUnknown',
											'Sie müssen nichts tun'
										)
									: tr(
											'barStatus',
											`${ahead} vor Ihnen — Sie müssen nichts tun`,
											{ count: ahead }
										)
							}
							progress={progress}
							icon={<TurningClock />}
						/>
					</Box>
				</RegistrationFooter>
			)}

			{accepted && (
				<RegistrationFooter animateIn>
					<Box
						data-cy="live-chat-consent"
						sx={{ flex: 1, minWidth: 0, py: { xs: 1, sm: 2 } }}
					>
						<Box
							sx={{
								display: 'flex',
								gap: 2,
								alignItems: 'flex-start'
							}}
						>
							<ShieldOutlinedIcon
								aria-hidden
								sx={{
									fontSize: 40,
									color: registrationMd3.primary,
									flexShrink: 0
								}}
							/>
							<Box sx={{ minWidth: 0 }}>
								<Typography
									sx={{ fontSize: 22, fontWeight: 700 }}
								>
									{tr('yourTurn', 'Sie sind dran.')}
								</Typography>
								<Typography
									sx={{
										mt: 0.5,
										fontSize: 15,
										color: registrationMd3.onSurfaceVariant
									}}
								>
									{counsellorLine ??
										tr(
											'yourTurnSub',
											'Eine Beraterin hat Ihr Gespräch angenommen und wartet auf Sie.'
										)}
								</Typography>
								<Typography
									component="div"
									sx={{
										'mt': 1.25,
										'fontSize': 14,
										'lineHeight': '20px',
										'fontWeight': 600,
										'& a': {
											color: registrationMd3.primary
										}
									}}
								>
									{htmlParser(
										sanitizeConsentHtml(consentHtml)
									)}
								</Typography>
							</Box>
						</Box>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 2,
								mt: 2
							}}
						>
							<ButtonBase
								aria-label={tr(
									'decline',
									'Nicht zustimmen und Chat verlassen'
								)}
								onClick={() => setLeaving(true)}
								disabled={busy}
								sx={{
									width: 56,
									height: 56,
									flexShrink: 0,
									borderRadius: '50%',
									border: `1.5px solid ${registrationMd3.outline}`,
									color: registrationMd3.onSurfaceVariant
								}}
							>
								<CloseRoundedIcon />
							</ButtonBase>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<HandoverGateButton
									state={busy ? 'entering' : 'ready'}
									onEnter={onAccept}
									label={tr('start', 'Zustimmen & starten')}
									status={tr(
										'startStatus',
										'Ihre Beraterin wartet auf Sie'
									)}
								/>
							</Box>
						</Box>
					</Box>
				</RegistrationFooter>
			)}

			<LeaveQueueDialog
				open={leaving}
				canStartChat={accepted}
				busy={busy}
				errorMessage={
					leaveFailed
						? t(
								'anonymousChat.leaveQueue.error',
								'Der Chat konnte gerade nicht beendet werden. Bitte versuchen Sie es noch einmal.'
							)
						: undefined
				}
				onStay={() => setLeaving(false)}
				onStartChat={() => {
					setLeaving(false);
					onAccept();
				}}
				onDeleteAccess={() => {
					void onLeave();
				}}
			/>
		</>
	);
};
