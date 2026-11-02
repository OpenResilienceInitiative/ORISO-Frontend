import * as React from 'react';
import { useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext
} from '../../globalState/provider/NotificationsProvider';
import { withTimeout } from '../../utils/promiseTimeout';
import { KeepMessagesDialog } from './KeepMessagesDialog';
import { MessageRetention } from './messageRetention';
import {
	answerRetention,
	getOwnTemporaryAccount,
	loadTemporaryAccount,
	needsRetentionAnswer,
	useOwnTemporaryAccount
} from './temporaryAccountStore';

/**
 * #1869 / ORISO-UserService#1486: a guest whose platform lets them decide is
 * asked once, before the first message or upload, whether their messages
 * stay. `gate(proceed)` returns `true` when it took over: `proceed` then runs
 * after the answer, or not at all when the guest cancels (the draft stays).
 * Until the account is known, a send waits for the lookup (retried when it
 * failed), at most `LOOKUP_WAIT_MS`; if it fails again or takes longer, the
 * send goes out unasked, as for no account.
 */
export const LOOKUP_WAIT_MS = 5_000;

export const useGuestRetentionGate = (enabled: boolean) => {
	const { t } = useTranslation();
	const { addNotification } = useContext(NotificationsContext) ?? {
		addNotification: () => undefined
	};
	const { account, status } = useOwnTemporaryAccount(enabled);
	const [open, setOpen] = useState(false);
	const pending = useRef<(() => void) | null>(null);

	const gate = useCallback(
		(proceed: () => void) => {
			if (!enabled) return false;
			if (status === 'ready') {
				if (!needsRetentionAnswer(account)) return false;
				pending.current = proceed;
				setOpen(true);
				return true;
			}
			pending.current = proceed;
			void withTimeout(
				loadTemporaryAccount(),
				LOOKUP_WAIT_MS,
				'temporary account lookup'
			)
				.catch(() => undefined)
				.then(() => {
					if (pending.current !== proceed) return;
					if (
						needsRetentionAnswer(getOwnTemporaryAccount().account)
					) {
						setOpen(true);
						return;
					}
					pending.current = null;
					proceed();
				});
			return true;
		},
		[account, enabled, status]
	);

	const confirm = useCallback(
		async (choice: MessageRetention) => {
			setOpen(false);
			const proceed = pending.current;
			pending.current = null;
			try {
				await answerRetention(choice);
				proceed?.();
			} catch {
				addNotification({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: t('temporaryAccount.keepDialog.failed'),
					text: '',
					closeable: true,
					timeout: 5000
				});
			}
		},
		[addNotification, t]
	);

	const cancel = useCallback(() => {
		pending.current = null;
		setOpen(false);
	}, []);

	const dialog = open ? (
		<KeepMessagesDialog open onConfirm={confirm} onCancel={cancel} />
	) : null;

	return { gate, dialog };
};
