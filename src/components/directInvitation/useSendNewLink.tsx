/**
 * #2252 "Neuen Link senden", wherever the counsellor starts it: from the
 * pop-up after a request, from the conversation's ⋮ menu or from the
 * overview. It renews the invitation (the backend also posts the new link
 * into the conversation), refreshes the link lists and shows the new link to
 * share. A failure is a titled pop-up on the stack.
 */
import * as React from 'react';
import { useCallback, useState } from 'react';
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

export const useSendNewLink = (stack: SnackbarStack = appSnackbarStack) => {
	const { t } = useTranslation();
	const { fromL } = useResponsive();
	const [renewed, setRenewed] = useState<DirectLink>();
	const [pending, setPending] = useState<string>();

	/** @returns whether the new link was made */
	const send = useCallback(
		async (linkId: string): Promise<boolean> => {
			setPending(linkId);
			try {
				const link = await apiRenewDirectInvitation(linkId);
				notifyDirectLinksChanged();
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
				setPending(undefined);
			}
		},
		[stack, t]
	);

	const dialog = renewed ? (
		<DirectLinkShareDialog
			open
			link={renewed}
			fullScreen={!fromL}
			onClose={() => setRenewed(undefined)}
		/>
	) : null;

	return { send, pending, dialog };
};
