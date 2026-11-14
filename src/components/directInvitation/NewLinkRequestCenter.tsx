/**
 * #2252, decision 7: someone asked for a new link after a Direkteinladung
 * expired ("Neuen Link anfragen"). The backend leaves an in-app notification
 * (`direct_invitation.renewal_requested`, param `linkId`); every unread one
 * becomes a pop-up with "Neuen Link senden", one per invitation. Sending
 * renews the invitation (the backend also posts the link into the
 * conversation), marks the requests read and shows the new link.
 */
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationsContext } from '../../globalState';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import { apiGetOwnDirectLinks } from '../../api/apiDirectLinks';
import {
	appSnackbarStack,
	type SnackbarStack
} from '../m3Snackbar/snackbarStack';
import { DIRECT_INVITATION_RENEWAL_REQUESTED } from '../notificationsCenter/eventDescriptors/directInvitationEvents';
import {
	newLinkRequestEntry,
	type NewLinkRequest
} from './NewLinkRequestNotice';
import { useSendNewLink } from './useSendNewLink';

const linkIdOf = (item: NotificationFeedItem): string | null => {
	const value = (item.params as Record<string, unknown> | undefined)?.linkId;
	return typeof value === 'number' || typeof value === 'string'
		? String(value)
		: null;
};

export const NewLinkRequestCenter = ({
	stack = appSnackbarStack
}: {
	/** Defaults to the app-wide stack that `M3SnackbarHost` shows. */
	stack?: SnackbarStack;
}) => {
	const { t } = useTranslation();
	const notifications = useContext(NotificationsContext);
	const feed = notifications?.notificationFeed;
	const markRead = notifications?.markNotificationAsRead;
	const [names, setNames] = useState<Record<string, string>>();
	const { send: renew, dialog } = useSendNewLink(stack);
	const shown = useRef(new Set<string>());

	/* Unread requests by invitation; older rows of the same one go along. */
	const open = useMemo(() => {
		const byLink = new Map<string, string[]>();
		(feed ?? []).forEach((item) => {
			if (item.eventType !== DIRECT_INVITATION_RENEWAL_REQUESTED) return;
			if (item.readAt) return;
			const linkId = linkIdOf(item);
			if (!linkId) return;
			byLink.set(linkId, [...(byLink.get(linkId) ?? []), item.id]);
		});
		return byLink;
	}, [feed]);

	/* The pop-up names the invitation; its name lives with the links. An
	   invitation made after the last read is read again. */
	const unknown = useMemo(
		() =>
			names !== undefined &&
			[...open.keys()].some(
				(linkId) => !shown.current.has(linkId) && !(linkId in names)
			),
		[names, open]
	);
	useEffect(() => {
		if (open.size === 0 || (names && !unknown)) return;
		let active = true;
		apiGetOwnDirectLinks().then(
			(links) =>
				active &&
				setNames(
					Object.fromEntries(
						links.map((link) => [link.id, link.name])
					)
				),
			() => active && setNames((known) => known ?? {})
		);
		return () => {
			active = false;
		};
	}, [names, open.size, unknown]);

	const openRef = useRef(open);
	openRef.current = open;

	useEffect(() => {
		if (!names) return;
		const send = async ({ invitationId }: NewLinkRequest) => {
			if (await renew(invitationId)) {
				(openRef.current.get(invitationId) ?? []).forEach((id) =>
					markRead?.(id)
				);
			}
		};
		open.forEach((_ids, linkId) => {
			if (shown.current.has(linkId)) return;
			/* Wait for a read that knows this invitation; a failed read
			   shows it without a name rather than not at all. */
			if (!(linkId in names) && unknown) return;
			shown.current.add(linkId);
			stack.enqueue(
				newLinkRequestEntry(
					{
						invitationId: linkId,
						invitationName: names[linkId] ?? ''
					},
					t,
					send
				)
			);
		});
	}, [markRead, names, open, renew, stack, t, unknown]);

	return dialog;
};
