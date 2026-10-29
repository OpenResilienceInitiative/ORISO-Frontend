import * as React from 'react';
import { useRef, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SentimentSatisfiedAltOutlinedIcon from '@mui/icons-material/SentimentSatisfiedAltOutlined';
import { HandoverGateButton } from '../../app/registrationLoader/HandoverGateButton';
import { ClosingSwapResult } from '../../transition/closing/playClosingAnimation';
import {
	HandoverCarousel,
	HandoverStep
} from '../../app/registrationLoader/HandoverCarousel';
import { BreathingCompanionHost } from '../../pseudonym/breathingCompanion/BreathingCompanionHost';
import { LeaveQueueDialog } from '../../pseudonym/LeaveQueueDialog';
import { WaitingRoomTemplate } from '../../waitingRoom/WaitingRoomTemplate';
import {
	useWaitingRoomConsent,
	WaitingRoomConsentPanel
} from '../../waitingRoom/WaitingRoomConsent';
import { liveChatArtwork } from '../../../resources/img/registration-md3/registrationArtwork';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';

export interface LiveChatWaitingRoomProps {
	/** People ahead in the queue; `null` while unknown. */
	ahead: number | null;
	/** A counsellor has taken the conversation. */
	accepted: boolean;
	/**
	 * Nobody is live right now (confirmed by the entry room) and the person
	 * chose to wait. The room says so and that it keeps watching, instead of
	 * promising that it starts soon (#1270). Ignored once `accepted`.
	 */
	nobodyLive?: boolean;
	/** Who took it — shown once known, otherwise omitted. */
	counsellorLine?: string;
	/**
	 * The tenant's consent sentence as HTML (legal links inside). Rendered
	 * through the ADR-022 sanitizer, never raw.
	 */
	consentHtml: string;
	/**
	 * The accepting centre's department (ADR-003: agency × topic), once known.
	 * Its legal links then open that department's documents; before, the
	 * platform's (ADR-022: no Beratungsstelle is assigned yet).
	 */
	department?: { agencyId: number; topicId: number } | null;
	/**
	 * Start the chat. A promise it returns keeps the closing animation's cover
	 * on until the page is replaced (or the start failed).
	 */
	onAccept: () => ClosingSwapResult;
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

/** Ties the checkbox to its error message via `aria-describedby`. */
const CONSENT_ERROR_ID = 'liveChatWaitingConsentError';

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
 *
 * The consent is a real checkbox with an error state, not a sentence the
 * button implies agreement to (#1341 item 2), and the X leads into
 * `LeaveQueueDialog` carrying an explicit „Sind Sie sicher…?" (item 3).
 */
export const LiveChatWaitingRoom = ({
	ahead,
	accepted,
	nobodyLive = false,
	counsellorLine,
	consentHtml,
	department,
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
	const consent = useWaitingRoomConsent({ consentHtml, department });
	/* The one way in: the gate button asks for consent, plays the closing
	   animation and then starts the chat. The dialog's "start chat" presses
	   this very button, so it cannot walk around either. */
	const gateRef = useRef<HTMLButtonElement>(null);
	const handleStart = () => consent.guard(onAccept);
	/* The contract: when counselling starts, unmount. Accepted wins over
	   whatever the person was doing — the breathing companion included. */
	const companionOpen = companion && !accepted;
	const total = Math.max(5, ahead ?? 0);

	const showNobodyLive = nobodyLive && !accepted;
	const cards: HandoverStep[] = CARD_KEYS.map((key) => ({
		key: `live-${key}`,
		artwork: liveChatArtwork[key],
		titleKey: `liveChat.entry.steps.${key}.title`,
		/* "…in anderen Gesprächen" would contradict the notice above. */
		textKey:
			key === 'wait' && showNobodyLive
				? 'liveChat.entry.steps.wait.textNobodyLive'
				: `liveChat.entry.steps.${key}.text`,
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

	const aheadLine = showNobodyLive
		? tr(
				'nobodyLive',
				'Wir behalten das im Blick und verbinden Sie, sobald jemand verfügbar ist.'
			)
		: ahead === null
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
			<WaitingRoomTemplate
				headline={
					showNobodyLive
						? tr(
								'nobodyLiveHeadline',
								'Gerade ist keine Beraterin live.'
							)
						: tr('headline', 'Gleich geht es los.')
				}
				statusLeading={
					!accepted && ahead !== null ? (
						<QueueDots ahead={ahead} total={total} />
					) : undefined
				}
				statusEmphasis={accepted}
				status={
					accepted
						? tr('accepted', 'Eine Beraterin ist da.')
						: aheadLine
				}
				contentBox={!companionOpen}
				aside={
					!accepted && !companionOpen ? (
						<>
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
								{tr(
									'companion',
									'Ruhige Begleitung, bis es losgeht'
								)}
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
						</>
					) : undefined
				}
				consent={
					accepted ? (
						<WaitingRoomConsentPanel
							consent={consent}
							heading={tr('yourTurn', 'Sie sind dran.')}
							subtitle={
								counsellorLine ??
								tr(
									'yourTurnSub',
									'Eine Beraterin hat Ihr Gespräch angenommen und wartet auf Sie.'
								)
							}
							declineLabel={tr(
								'decline',
								'Nicht zustimmen und Chat verlassen'
							)}
							onDecline={() => setLeaving(true)}
							missingText={tr(
								'consentRequired',
								'Bitte stimmen Sie erst zu — ohne Ihre Zustimmung kann das Gespräch nicht beginnen.'
							)}
							errorId={CONSENT_ERROR_ID}
							disabled={busy}
						/>
					) : undefined
				}
				gate={
					accepted ? (
						<Box
							data-cy="live-chat-consent"
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 2,
								width: '100%',
								minWidth: 0
							}}
						>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<HandoverGateButton
									state={busy ? 'entering' : 'ready'}
									buttonRef={gateRef}
									/* Consent is asked before the closing animation
									   starts, so the screen never closes on a "no". */
									beforeEnter={consent.check}
									onEnter={() => onAccept()}
									closing="messageField"
									label={tr('start', 'Gespräch beginnen')}
									status={tr(
										'startStatus',
										'Ihre Beraterin wartet auf Sie'
									)}
								/>
							</Box>
						</Box>
					) : (
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
								indeterminate
								icon={<TurningClock />}
							/>
						</Box>
					)
				}
			>
				{companionOpen ? (
					<BreathingCompanionHost
						onClose={() => setCompanion(false)}
					/>
				) : (
					<HandoverCarousel steps={cards} />
				)}
			</WaitingRoomTemplate>

			<LeaveQueueDialog
				open={leaving}
				canStartChat={accepted}
				busy={busy}
				/* Frank's warning (#1341 item 3). The dialog already asks
				   „Chat verlassen?" and offers stay / start / delete, so the X
				   gets his sentence *inside* it rather than a second dialog
				   stacked in front of the first. */
				confirmPrompt={tr(
					'declineConfirm',
					'Sind Sie sicher, dass Sie abbrechen wollen und schließen?'
				)}
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
					/* Through the same gate as the primary action. Starting
					   from inside the dialog is still starting, and consent
					   that can be walked around is not a consent gate. */
					setLeaving(false);
					if (gateRef.current) {
						gateRef.current.click();
					} else {
						handleStart();
					}
				}}
				onDeleteAccess={() => {
					void onLeave();
				}}
			/>
		</>
	);
};
