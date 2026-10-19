import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { HandoverCarousel, HandoverStep } from './HandoverCarousel';
import { HandoverGateButton } from './HandoverGateButton';
import { ClosingFocal } from '../../transition/closing/closingFocal';
import { GATE_STATUS_KEY, HandoverGateState } from './handoverGate';
import { useHandoverProgress } from './handoverProgress';
import { EntryRoomShell } from '../../anonymousChat/entryRoom/EntryRoomShell';
import { WaitingRoomTemplate } from '../../waitingRoom/WaitingRoomTemplate';

/** After this the gate opens regardless, labelled honestly as "taking longer". */
const SLOW_AFTER_MS = 20000;

export interface RegistrationHandoverProps {
	/** The real "everything behind the gate has loaded" signal (appReady). */
	ready: boolean;
	/** Called when the user opens the gate. Must land them in the message field. */
	onEnter: () => void;
	/**
	 * The department the person registered for (agency × topic): the legal
	 * links open its documents instead of the platform's (ADR-022).
	 */
	department?: { agencyId: number; topicId: number } | null;
	/**
	 * Where the person ends up. The platform's closing animation plays on the
	 * way and ends on this focal point (ORISO-Frontend#1737). A standard
	 * counselling chat is the default; a video call says `call`. `null` plays
	 * no closing animation: after a group link the next screen is the group's
	 * entry room, another waiting room with no message field to end on (its own
	 * "join" gate carries the animation into the chat).
	 */
	closing?: ClosingFocal | null;
	/** Force a gate state instead of deriving it from `ready`. */
	forcedState?: HandoverGateState;
	/**
	 * Fill while waiting, 0–100. Defaults to the share of finished handover
	 * milestones (`handoverProgress`), so the bar moves when work finishes
	 * and never on a timer.
	 */
	progress?: number;
	/**
	 * The words and cards of another way in. All already translated; every
	 * one defaults to the registration's. The live-chat entry room passes
	 * its own so this screen is one module for every entry, not a copy per
	 * entry (Frank, 2026-09-05).
	 */
	copy?: {
		badge?: string;
		headline?: string;
		subline?: string;
		encryption?: string;
		cta?: string;
		/** The gate button's status line per state; unset states keep theirs. */
		status?: Partial<Record<HandoverGateState, string>>;
		steps?: HandoverStep[];
	};
}

/**
 * The waiting room between "Registrieren" and the message field.
 *
 * It always stands in the white column of a `StageLayout`, on both sides of
 * the document load that follows registration: `Registration` shows it from
 * the click on, `AuthenticatedApp` shows it again after the load, in the same
 * stage and at the same fill. To the person it is one screen (#1219). There is
 * no overlay variant any more — one painted over the whole viewport and lost
 * the red stage, which is the jump Frank saw on 2026-10-09.
 *
 * The button underneath is the gate: it opens once everything behind it is
 * loaded, so the click lands them in a room they can type into immediately.
 *
 * Loading priority (Frank, 2026-08-06): this markup paints on the first frame
 * without network; the card motifs are lazy with reserved boxes.
 */
export const RegistrationHandover = ({
	ready,
	onEnter,
	forcedState,
	progress,
	closing = 'messageField',
	copy,
	department
}: RegistrationHandoverProps) => {
	const { t } = useTranslation();
	const milestoneProgress = useHandoverProgress();
	const [slow, setSlow] = useState(false);
	const [entering, setEntering] = useState(false);
	const enteredRef = useRef(false);

	useEffect(() => {
		const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
		return () => clearTimeout(timer);
	}, []);

	const state: HandoverGateState =
		forcedState ??
		(entering ? 'entering' : ready ? 'ready' : slow ? 'slow' : 'preparing');

	/* While waiting the fill is the real share of finished work; once the
	   gate opens the state's own 100 takes over. */
	const fill =
		state === 'preparing' || state === 'slow'
			? (progress ?? milestoneProgress)
			: undefined;
	/* "Fast" goes away exactly when the way on is free — the same moment the
	   gate button stops waiting. `forcedState` is a test seam, so it decides
	   here too. */
	const handoverDone = state === 'ready' || state === 'entering';

	const handleEnter = useCallback(() => {
		if (enteredRef.current) {
			return;
		}
		enteredRef.current = true;
		setEntering(true);
		onEnter();
	}, [onEnter]);

	/* Laid out by the live-chat room's template (Frank, 2026-10-16: "die
	   Elemente sind ja vom Content her alle richtig, aber ich will den
	   Live-Chat"). The badge becomes the room's kicker, as "Live-Chat" is
	   there; the headline still turns from "Fast geschafft." into
	   "Geschafft." the moment the way on is free (Frank, 2026-09-01). */
	const headline =
		copy?.headline ??
		(handoverDone
			? t('registration.handover.headline')
			: t('registration.handover.headlineAlmost'));

	return (
		<EntryRoomShell
			department={department}
			kicker={copy?.badge ?? t('registration.handover.badge')}
			statusLine={copy?.status?.[state] ?? t(GATE_STATUS_KEY[state])}
		>
			{/* `contents`: the template's parts stay children of the room's
			    column; this box only carries the test hooks. */}
			<Box
				data-cy="registration-handover"
				data-cy-progress={fill ?? 100}
				sx={{ display: 'contents' }}
			>
				<WaitingRoomTemplate
					headline={headline}
					status={copy?.subline ?? t('registration.handover.subline')}
					aside={
						<Box
							sx={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: 1.25,
								fontSize: { xs: 12, sm: 13 },
								lineHeight: { xs: '17px', sm: '18px' },
								color: registrationMd3.onSurfaceVariant
							}}
						>
							<LockOutlinedIcon
								aria-hidden
								sx={{ fontSize: 18, flexShrink: 0, mt: '1px' }}
							/>
							<Typography
								component="span"
								sx={{ fontSize: 'inherit' }}
							>
								{copy?.encryption ??
									t('registration.handover.encryption')}
							</Typography>
						</Box>
					}
					gate={
						<Box sx={{ flex: '1 1 0', minWidth: 0 }}>
							<HandoverGateButton
								state={state}
								onEnter={handleEnter}
								closing={closing ?? undefined}
								label={copy?.cta}
								/* The room's status line above already says
								   (and announces) this state; a second live
								   region would read it twice. */
								status=""
								progress={fill}
							/>
						</Box>
					}
				>
					<HandoverCarousel steps={copy?.steps} />
				</WaitingRoomTemplate>
			</Box>
		</EntryRoomShell>
	);
};
