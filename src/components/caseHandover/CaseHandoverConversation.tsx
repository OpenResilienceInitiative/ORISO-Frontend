import * as React from 'react';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import './CaseHandoverConversation.styles.scss';
import { useEffect, useRef, useState } from 'react';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { useTranslation } from 'react-i18next';
import { isPendingCaseHandoverStatus } from '../../api/apiCaseHandover';
import { useDismissibleNotice } from '../../hooks/useDismissibleNotice';
import { CaseHandoverConsentCard } from './CaseHandoverClientCards';
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';
import { notificationChannelPolicy } from '../erstantwort/notificationChannelPolicy';
import { NotificationSetup } from '../erstantwort/NotificationSetup';

/** The caller keys this continuation by session, so transient setup never moves
 * into another conversation. Account/device settings remain their existing stores. */
export const CaseHandoverConversation = ({
	conversationType,
	dismissKey,
	...consent
}: Omit<React.ComponentProps<typeof CaseHandoverConsentCard>, 'onDismiss'> & {
	conversationType?: string;
	/** Id of the notification behind the message; remembers its dismissal. */
	dismissKey?: string;
}) => {
	const { t } = useTranslation();
	const tenant = useTenant();
	const channels = notificationChannelPolicy(
		tenant?.settings,
		conversationType
	);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [focusRequest, setFocusRequest] = useState(0);
	const notificationMessage = useRef<HTMLDivElement>(null);
	/*
	 * The message can be closed (ORISO-Frontend#1700). Only a message with
	 * nothing left to act on stays closed after a reload; one that still waits
	 * for the client's decision comes back, so closing it can't lose the choice.
	 */
	const isSettled =
		consent.mode === 'NONE' ||
		(!!consent.status && !isPendingCaseHandoverStatus(consent.status));
	const { dismissed, dismiss } = useDismissibleNotice(dismissKey, {
		persist: isSettled
	});
	const [composerFocusRequest, setComposerFocusRequest] = useState(0);

	useEffect(() => {
		if (!focusRequest) return;
		// The M3 dialog first completes its close transition and restores focus.
		const timer = window.setTimeout(() => {
			notificationMessage.current?.scrollIntoView?.({
				behavior: 'smooth',
				block: 'nearest'
			});
			notificationMessage.current?.focus();
		}, 300);
		return () => window.clearTimeout(timer);
	}, [focusRequest]);

	useEffect(() => {
		if (!composerFocusRequest) return;
		// The closed message took focus with it; hand it to the person's next
		// step, writing. Keyboard dismissal only, so a tap never raises the
		// on-screen keyboard.
		document
			.querySelector<HTMLElement>(
				'.messageSubmit__wrapper [contenteditable="true"]'
			)
			?.focus();
	}, [composerFocusRequest]);

	return (
		<>
			{!dismissed && (
				<CaseHandoverConsentCard
					{...consent}
					onDismiss={(viaKeyboard) => {
						dismiss();
						if (viaKeyboard) {
							setComposerFocusRequest((value) => value + 1);
						}
					}}
					onSetupNotifications={
						channels.emailAllowed || channels.browserAllowed
							? () => {
									setNotificationsOpen(true);
									setFocusRequest((value) => value + 1);
								}
							: undefined
					}
				/>
			)}
			{notificationsOpen &&
				(channels.emailAllowed || channels.browserAllowed) && (
					<div
						ref={notificationMessage}
						className="caseHandoverNotificationMessage"
						tabIndex={-1}
						role="region"
						aria-label={t(
							'caseHandover.consent.info.notificationsAction'
						)}
					>
						<ErstantwortSequence
							skipAnimation
							bausteine={[
								{
									id: 'handoverNotifications',
									body: '',
									headline: ''
								}
							]}
							slots={{
								handoverNotifications: (
									<>
										<h3 className="caseHandoverNotificationTitle">
											<NotificationsNoneOutlined
												aria-hidden
											/>
											{t(
												'caseHandover.consent.info.notificationsAction'
											)}
										</h3>
										<NotificationSetup
											isBrowserEnabled={
												channels.browserAllowed
											}
											isEmailEnabled={
												channels.emailAllowed
											}
										/>
									</>
								)
							}}
						/>
					</div>
				)}
		</>
	);
};
