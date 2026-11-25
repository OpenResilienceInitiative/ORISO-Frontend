/**
 * ORISO-Frontend#2356: what a signed-in counsellor sees on a Direkteinladung's
 * page. They join the call only, with their own account; the conversation's
 * counsellor lets them in like a guest. One room of the shared waiting-room
 * frame (`EntryRoomShell` → `WaitingRoomFrame`, the shared bar), in the
 * pattern of `InvitationEntryStates`.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CallEndOutlinedIcon from '@mui/icons-material/CallEndOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { EntryRoomShell } from '../../anonymousChat/entryRoom/EntryRoomShell';
import { WaitingRoomBar } from '../../waitingRoom/WaitingRoomBar';
import { registrationScreenTitleSx } from '../../registration/registrationDesign/registrationDesign';
import {
	RoomIcon,
	RoomText,
	roomColumnSx
} from '../../directInvitation/InvitationEntryStates';

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
	const primary =
		phase === 'offer' || phase === 'joining' || phase === 'error'
			? {
					label: t(
						phase === 'error'
							? `${STAFF_JOIN_KEYS}.retry`
							: `${STAFF_JOIN_KEYS}.offer.join`
					),
					onClick: onJoin,
					busy: phase === 'joining',
					disabled: phase === 'joining',
					testId: 'staff-join-button'
				}
			: phase === 'waiting' || phase === 'notStarted'
				? {
						label: t(`${STAFF_JOIN_KEYS}.cancel`),
						onClick: onCancel,
						testId: 'staff-join-cancel'
					}
				: {
						label: t(`${STAFF_JOIN_KEYS}.openOwnSessions`),
						onClick: onOpenOwnSessions,
						testId: 'staff-join-own-sessions'
					};
	return (
		<EntryRoomShell
			kicker={t(`${STAFF_JOIN_KEYS}.kicker`)}
			statusLine={t(`${STAFF_JOIN_KEYS}.${key}.status`)}
		>
			<Box
				component="section"
				aria-labelledby="staffJoinTitle"
				data-testid="staff-join-room"
				data-phase={phase}
				sx={roomColumnSx}
			>
				<RoomIcon>{icon}</RoomIcon>
				<Typography
					id="staffJoinTitle"
					component="h1"
					sx={{ ...registrationScreenTitleSx, mt: 3 }}
				>
					{t(`${STAFF_JOIN_KEYS}.${key}.title`)}
				</Typography>
				<RoomText>{t(`${STAFF_JOIN_KEYS}.${key}.text`)}</RoomText>
			</Box>
			<WaitingRoomBar primary={primary} />
		</EntryRoomShell>
	);
};
