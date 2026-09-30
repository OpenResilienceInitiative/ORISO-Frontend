import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Snackbar } from '../../m3Snackbar/M3Snackbar';
import {
	appSnackbarStack,
	SnackbarStack
} from '../../m3Snackbar/snackbarStack';
import { JoinRequestDialog } from './JoinRequestDialog';
import { JoinRequestSnackbar } from './JoinRequestSnackbar';
import {
	GroupChatJoinAdmitRole,
	GroupChatJoinRequest
} from './joinRequestModel';
import { JoinRequestTransport } from './joinRequestTransport';

export interface JoinRequestCenterProps {
	transport: JoinRequestTransport;
	/** Defaults to the app-wide stack that `M3SnackbarHost` shows. */
	stack?: SnackbarStack;
	/** Fixed clock for stories and screenshots; live otherwise. */
	now?: Date;
}

const CONFIRMATION_MS = 5000;
const FAILURE_MS = 8000;

const entryIdOf = (request: GroupChatJoinRequest) =>
	`join-request-${request.id}`;

/** Re-renders once a minute, so "vor 3 Min." keeps counting. */
const useMinuteClock = (fixed?: Date) => {
	const [now, setNow] = useState(() => fixed ?? new Date());
	useEffect(() => {
		if (fixed) {
			setNow(fixed);
			return;
		}
		const timer = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(timer);
	}, [fixed]);
	return now;
};

/**
 * The moderator's side of knocking (#1499): every open request of every
 * group she moderates becomes a join-request snackbar in the app-wide stack,
 * oldest first, and stays until somebody decides — she, from the snackbar or
 * its popup, or a co-moderator elsewhere (then it simply goes away).
 * Renders nothing itself except the popup.
 */
export const JoinRequestCenter = ({
	transport,
	stack = appSnackbarStack,
	now: fixedNow
}: JoinRequestCenterProps) => {
	const { t } = useTranslation();
	const now = useMinuteClock(fixedNow);
	const [pending, setPending] = useState<GroupChatJoinRequest[]>([]);
	const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
	const [detailsId, setDetailsId] = useState<number | null>(null);
	const enqueued = useRef(new Set<string>());

	useEffect(() => transport.watchPending(setPending), [transport]);

	const note = useCallback(
		(message: string, autoHideDuration: number) =>
			stack.enqueue({
				announcement: message,
				autoHideDuration,
				render: ({ dismiss }) => (
					<M3Snackbar
						placement="inline"
						role="status"
						message={message}
						onClose={dismiss}
						closeLabel={t('app.close')}
						sx={{ maxWidth: 'none' }}
					/>
				)
			}),
		[stack, t]
	);

	const setBusyFor = useCallback((id: number, value: boolean) => {
		setBusy((current) => {
			const next = new Set(current);
			if (value) next.add(id);
			else next.delete(id);
			return next;
		});
	}, []);

	const decide = useCallback(
		(
			request: GroupChatJoinRequest,
			decision: Promise<void>,
			confirmation: string
		) => {
			setBusyFor(request.id, true);
			decision
				.then(() => {
					setPending((current) =>
						current.filter((item) => item.id !== request.id)
					);
					setDetailsId((id) => (id === request.id ? null : id));
					note(confirmation, CONFIRMATION_MS);
				})
				.catch(() =>
					note(t('groupChat.joinRequest.failed'), FAILURE_MS)
				)
				.finally(() => setBusyFor(request.id, false));
		},
		[note, setBusyFor, t]
	);

	const admit = useCallback(
		(request: GroupChatJoinRequest, role: GroupChatJoinAdmitRole) =>
			decide(
				request,
				transport.admit(request, role),
				t(
					role === 'CO_MODERATOR'
						? 'groupChat.joinRequest.admittedAsCoModerator'
						: 'groupChat.joinRequest.admitted',
					{ name: request.requester.displayName }
				)
			),
		[decide, t, transport]
	);

	const decline = useCallback(
		(request: GroupChatJoinRequest) =>
			decide(
				request,
				transport.decline(request),
				t('groupChat.joinRequest.declined', {
					name: request.requester.displayName
				})
			),
		[decide, t, transport]
	);

	useEffect(() => {
		const current = new Set<string>();
		pending.forEach((request) => {
			const id = entryIdOf(request);
			current.add(id);
			stack.enqueue({
				id,
				dismissible: false,
				announcement: t('groupChat.joinRequest.announcement', {
					name: request.requester.displayName,
					group: request.groupTitle
				}),
				render: () => (
					<JoinRequestSnackbar
						request={request}
						now={now}
						busy={busy.has(request.id)}
						onAdmit={() => admit(request, 'PARTICIPANT')}
						onDecline={() => decline(request)}
						onDetails={() => setDetailsId(request.id)}
					/>
				)
			});
		});
		enqueued.current.forEach((id) => {
			if (!current.has(id)) stack.dismiss(id);
		});
		enqueued.current = current;
	}, [admit, busy, decline, now, pending, stack, t]);

	useEffect(
		() => () => {
			enqueued.current.forEach((id) => stack.dismiss(id));
			enqueued.current = new Set();
		},
		[stack]
	);

	const details = pending.find((request) => request.id === detailsId);
	return details ? (
		<JoinRequestDialog
			open
			request={details}
			now={now}
			busy={busy.has(details.id)}
			onAdmit={(role) => admit(details, role)}
			onDecline={() => decline(details)}
			onClose={() => setDetailsId(null)}
		/>
	) : null;
};
