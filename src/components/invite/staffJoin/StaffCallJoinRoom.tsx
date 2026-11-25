/**
 * ORISO-Frontend#2356: what a signed-in counsellor sees on a Direkteinladung's
 * page. They join the call only, with their own account; the conversation's
 * counsellor lets them in like a guest. One room of the shared waiting-room
 * frame (`EntryRoomShell` → `WaitingRoomFrame`), laid out by the one
 * `WaitingRoomTemplate` with the `HandoverGateButton` as its gate.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, ButtonBase } from '@mui/material';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CallEndOutlinedIcon from '@mui/icons-material/CallEndOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { EntryRoomShell } from '../../anonymousChat/entryRoom/EntryRoomShell';
import { WaitingRoomTemplate } from '../../waitingRoom/WaitingRoomTemplate';
import { HandoverGateButton } from '../../app/registrationLoader/HandoverGateButton';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { RoomIcon } from '../../directInvitation/InvitationEntryStates';

export const STAFF_JOIN_KEYS = 'directLink.staffJoin';

export type StaffJoinPhase =
	/** The choice: join the call as counsellor. */
	| 'offer'
	/** The request is on its way. */
	| 'joining'
	/** Knocked; the conversation's counsellor decides. */
	| 'waiting'
	/** No call runs yet; the page asks again by itself. */
	| 'notStarted'
	/** Declined for this call, or the waiting ran out. */
	| 'refused'
	/** Removed from this call, or not allowed. */
	| 'forbidden'
	/** The call this counsellor was in has ended. */
	| 'ended'
	/** A failure that may pass: try again. */
	| 'error';

export interface StaffCallJoinRoomProps {
	phase: StaffJoinPhase;
	medium: 'AUDIO' | 'VIDEO';
	onJoin: () => void;
	onCancel: () => void;
	onOpenOwnSessions: () => void;
}

const ICONS: Record<StaffJoinPhase, React.ReactNode> = {
	offer: null,
	joining: <HourglassEmptyOutlinedIcon />,
	waiting: <HourglassEmptyOutlinedIcon />,
	notStarted: <HourglassEmptyOutlinedIcon />,
	refused: <BlockOutlinedIcon />,
	forbidden: <BlockOutlinedIcon />,
	ended: <CallEndOutlinedIcon />,
	error: <BlockOutlinedIcon />
};

export const StaffCallJoinRoom = ({
	phase,
	medium,
	onJoin,
	onCancel,
	onOpenOwnSessions
}: StaffCallJoinRoomProps) => {
	const { t } = useTranslation();
	const key = phase === 'joining' ? 'offer' : phase;
	const icon =
		ICONS[phase] ??
		(medium === 'VIDEO' ? <VideocamOutlinedIcon /> : <CallOutlinedIcon />);
	const waiting = phase === 'waiting' || phase === 'notStarted';
	/* The gate: open to join or retry, a quiet sweep while waiting, and the
	   way back to the own conversations once this call is out of reach. */
	const gate =
		phase === 'offer' || phase === 'joining' || phase === 'error'
			? {
					state:
						phase === 'joining'
							? ('entering' as const)
							: ('ready' as const),
					label: t(
						phase === 'error'
							? `${STAFF_JOIN_KEYS}.retry`
							: `${STAFF_JOIN_KEYS}.offer.join`
					),
					onEnter: onJoin,
					testId: 'staff-join-button'
				}
			: waiting
				? {
						state: 'queued' as const,
						label: t(`${STAFF_JOIN_KEYS}.${key}.status`),
						onEnter: () => undefined,
						testId: 'staff-join-waiting'
					}
				: {
						state: 'ready' as const,
						label: t(`${STAFF_JOIN_KEYS}.openOwnSessions`),
						onEnter: onOpenOwnSessions,
						testId: 'staff-join-own-sessions'
					};
	return (
		<EntryRoomShell
			kicker={t(`${STAFF_JOIN_KEYS}.kicker`)}
			statusLine={t(`${STAFF_JOIN_KEYS}.${key}.status`)}
		>
			{/* `contents`: the template's parts stay children of the room's
			    column; this box only carries the test hooks. */}
			<Box
				data-testid="staff-join-room"
				data-phase={phase}
				sx={{ display: 'contents' }}
			>
				<WaitingRoomTemplate
					headline={t(`${STAFF_JOIN_KEYS}.${key}.title`)}
					status={t(`${STAFF_JOIN_KEYS}.${key}.text`)}
					aside={
						waiting ? (
							<ButtonBase
								data-testid="staff-join-cancel"
								onClick={onCancel}
								sx={{
									fontSize: 14,
									color: registrationMd3.onSurfaceVariant,
									textDecoration: 'underline',
									textAlign: 'left'
								}}
							>
								{t(`${STAFF_JOIN_KEYS}.cancel`)}
							</ButtonBase>
						) : undefined
					}
					gate={
						<Box sx={{ flex: '1 1 0', minWidth: 0 }}>
							<HandoverGateButton
								state={gate.state}
								onEnter={() => {
									gate.onEnter();
									return undefined;
								}}
								label={gate.label}
								/* The room's status line already says (and
								   announces) this; a second live region would
								   read it twice. */
								status=""
								testId={gate.testId}
							/>
						</Box>
					}
				>
					<Box
						sx={{
							flex: 1,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<RoomIcon>{icon}</RoomIcon>
					</Box>
				</WaitingRoomTemplate>
			</Box>
		</EntryRoomShell>
	);
};
