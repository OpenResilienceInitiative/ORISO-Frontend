/**
 * #2252 "Neuen Link senden", wherever the counsellor starts it: from the
 * pop-up after a request, from the conversation's ⋮ menu or from the
 * overview. It renews the invitation (the backend also posts the new link
 * into the conversation), refreshes the link lists and shows the new link to
 * share. A failure is a titled pop-up on the stack.
 */
import * as React from 'react';
import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiRenewDirectInvitation,
	notifyDirectLinksChanged
} from '../../api/apiDirectLinks';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import {
	appSnackbarStack,
	type SnackbarStack
} from '../m3Snackbar/snackbarStack';
import { useResponsive } from '../../hooks/useResponsive';
import { invitationErrorEntry } from './invitationErrorSnackbar';
import { NotificationsContext } from '../../globalState';
import { DIRECT_INVITATION_RENEWAL_REQUESTED } from '../notificationsCenter/eventDescriptors/directInvitationEvents';

/*
 * Each renewal issues a new token and expires the one before, so a second
 * click (or the header and the request pop-up at once) must not start a
 * second one: every caller shares the running renewal of that invitation.
 */
const running = new Map<string, Promise<DirectLink>>();

const renewOnce = (linkId: string): Promise<DirectLink> => {
	const pending = running.get(linkId);
	if (pending) return pending;
	const started = apiRenewDirectInvitation(linkId).finally(() => {
		running.delete(linkId);
	});
	running.set(linkId, started);
	return started;
};

export const useSendNewLink = (stack: SnackbarStack = appSnackbarStack) => {
	const { t } = useTranslation();
	const { fromL } = useResponsive();
	const notifications = useContext(NotificationsContext);
	const [renewed, setRenewed] = useState<DirectLink>();
	const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
		new Set()
	);

	/** @returns whether the new link was made */
	const send = useCallback(
		async (linkId: string): Promise<boolean> => {
			setPendingIds((before) => new Set(before).add(linkId));
			try {
				const link = await renewOnce(linkId);
				notifyDirectLinksChanged();
				/* A renewal from the overview or conversation menu also consumes
				   any request pop-up. Leaving it behind would let a later click
				   renew once more and invalidate the link just sent. */
				(notifications?.notificationFeed ?? []).forEach((item) => {
					const requestedLink = (
						item.params as Record<string, unknown> | undefined
					)?.linkId;
					if (
						item.eventType ===
							DIRECT_INVITATION_RENEWAL_REQUESTED &&
						!item.readAt &&
						String(requestedLink) === linkId
					) {
						notifications?.markNotificationAsRead(item.id);
					}
				});
				stack.dismiss(`new-link-request-${linkId}`);
				setRenewed(link);
				return true;
			} catch {
				stack.enqueue(
					invitationErrorEntry({
						id: `new-link-failed-${linkId}`,
						title: t('directInvitation.notice.failedTitle'),
						text: t('directInvitation.notice.failed'),
						t
					})
				);
				return false;
			} finally {
				setPendingIds((before) => {
					const next = new Set(before);
					next.delete(linkId);
					return next;
				});
			}
		},
		[notifications, stack, t]
	);

	const dialog = renewed ? (
		<DirectLinkShareDialog
			open
			link={renewed}
			fullScreen={!fromL}
			onClose={() => setRenewed(undefined)}
		/>
	) : null;

	return { send, pendingIds, dialog };
};
