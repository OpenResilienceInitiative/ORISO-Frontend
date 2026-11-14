/**
 * #2252, decision 7: the counsellor sends a new link from the chat on their
 * own, without waiting for "Neuen Link anfragen". While an invitation of
 * this conversation (its appointment conversation, or the 1:1 it came from)
 * has expired, this hands an opener up to the header's ⋮ menu ("Neuen Link
 * senden"); it renders only the share dialog of the new link.
 */
import { useEffect, useMemo, useState } from 'react';
import {
	apiGetOwnDirectLinks,
	DIRECT_LINKS_CHANGED_EVENT
} from '../../api/apiDirectLinks';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import type { SnackbarStack } from '../m3Snackbar/snackbarStack';
import { useSendNewLink } from './useSendNewLink';

export const ConversationNewLinkAction = ({
	sessionId,
	enabled,
	onChange,
	stack
}: {
	sessionId?: number;
	/** The conversation's counsellor, while it is open. */
	enabled: boolean;
	onChange: (open?: () => void) => void;
	stack?: SnackbarStack;
}) => {
	const [links, setLinks] = useState<DirectLink[]>([]);
	const [reload, setReload] = useState(0);
	const { send, dialog } = useSendNewLink(stack);

	useEffect(() => {
		const changed = () => setReload((n) => n + 1);
		window.addEventListener(DIRECT_LINKS_CHANGED_EVENT, changed);
		return () =>
			window.removeEventListener(DIRECT_LINKS_CHANGED_EVENT, changed);
	}, []);

	useEffect(() => {
		if (!enabled || sessionId === undefined) {
			setLinks([]);
			return undefined;
		}
		let active = true;
		apiGetOwnDirectLinks().then(
			(own) => active && setLinks(own),
			() => active && setLinks([])
		);
		return () => {
			active = false;
		};
	}, [enabled, sessionId, reload]);

	/* The newest expired invitation of this conversation (newest first). */
	const expired = useMemo(
		() =>
			links.find(
				(link) => link.expired === true && link.sessionId === sessionId
			),
		[links, sessionId]
	);

	useEffect(() => {
		onChange(expired ? () => void send(expired.id) : undefined);
		return () => onChange(undefined);
	}, [expired, onChange, send]);

	return dialog;
};
