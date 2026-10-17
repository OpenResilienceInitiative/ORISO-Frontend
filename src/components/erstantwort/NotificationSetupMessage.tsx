import * as React from 'react';
import { useContext, useEffect, useRef, useState } from 'react';
import { IconButton, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import { ErstantwortSequence } from './ErstantwortSequence';
import { NotificationSetup } from './NotificationSetup';
import { useNotificationChannels } from './useNotificationChannels';
import {
	readNotificationSetupCollapseState,
	writeNotificationSetupCollapseState,
	type NotificationSetupCollapseState
} from './notificationSetupCollapseState';
import './NotificationSetupMessage.styles.scss';

interface NotificationSetupMessageProps {
	/**
	 * Id of the chat message this setup belongs to. Together with the account
	 * it decides which collapsed/expanded state is remembered; without it the
	 * state lasts only while the message is on screen.
	 */
	messageId?: string;
	isEmailEnabled?: boolean;
	isBrowserEnabled?: boolean;
	/** Sender subtitle in the kicker line; defaults to the Erstantwort one. */
	subtitle?: string;
	/** Short copy above the choices; shown with them, gone when collapsed. */
	copy?: React.ReactNode;
	onStart?: () => void;
}

type ActiveChannels = 'none' | 'email' | 'browser' | 'both';

/**
 * A notification-setup message in the conversation: the full choice while the
 * person still has something to do, one quiet line ("Benachrichtigung: E-Mail
 * aktiv · ändern") once they have chosen or closed it. The message itself stays
 * in the history; only its card gets out of the way.
 *
 * The setup keeps running while collapsed (it is hidden, not unmounted), so a
 * browser dialog or a half-finished "both" setup is never torn down by a
 * collapse.
 */
export const NotificationSetupMessage = ({
	messageId,
	isEmailEnabled = true,
	isBrowserEnabled = true,
	subtitle,
	copy,
	onStart
}: NotificationSetupMessageProps) => {
	const { t } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const accountId = userData?.userId;
	const { emailActive, browserActive } = useNotificationChannels(
		isEmailEnabled,
		isBrowserEnabled
	);
	const active: ActiveChannels =
		emailActive && browserActive
			? 'both'
			: emailActive
				? 'email'
				: browserActive
					? 'browser'
					: 'none';

	const [stored, setStored] = useState<
		NotificationSetupCollapseState | undefined
	>(() =>
		messageId
			? readNotificationSetupCollapseState(accountId, messageId)
			: undefined
	);
	// "Set up both" is two steps; the message waits for the second one.
	const [bothPending, setBothPending] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const change = useRef<HTMLButtonElement>(null);
	const dismiss = useRef<HTMLButtonElement>(null);
	const focusChangeNext = useRef(false);
	const focusSetupNext = useRef(false);

	// Another message or another account in the same mounted tree.
	useEffect(() => {
		setStored(
			messageId
				? readNotificationSetupCollapseState(accountId, messageId)
				: undefined
		);
		setBothPending(false);
	}, [accountId, messageId]);

	const remember = (state: NotificationSetupCollapseState) => {
		const focusInside = !!root.current?.contains(document.activeElement);
		focusChangeNext.current = state === 'collapsed' && focusInside;
		focusSetupNext.current = state === 'expanded' && focusInside;
		setStored(state);
		if (messageId) {
			writeNotificationSetupCollapseState(accountId, messageId, state);
		}
	};

	/* Nothing remembered: follow the account. A reachable channel means the
	   card has done its job. */
	const collapsed =
		stored === 'collapsed' ||
		(stored === undefined && active !== 'none' && !bothPending);

	const seenActive = useRef(active);
	useEffect(() => {
		const changed = seenActive.current !== active;
		seenActive.current = active;
		if (active === 'none') return;
		if (bothPending) {
			if (active !== 'both') return;
			setBothPending(false);
		}
		// A channel chosen while the setup was reopened collapses it again; a
		// reopened setup is never closed just because it loaded with one.
		if (stored === undefined || (stored === 'expanded' && changed)) {
			remember('collapsed');
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active, bothPending, stored]);

	useEffect(() => {
		if (collapsed && focusChangeNext.current) {
			focusChangeNext.current = false;
			change.current?.focus();
		}
		// "ändern" is unmounted when the setup opens; keep keyboard focus inside the message.
		if (!collapsed && focusSetupNext.current) {
			focusSetupNext.current = false;
			dismiss.current?.focus();
		}
	}, [collapsed]);

	const stateLabel = t(`erstantwort.notificationSummary.${active}`);

	return (
		<ErstantwortSequence
			skipAnimation
			subtitle={subtitle}
			bausteine={[{ id: 'notificationSetup', headline: '', body: '' }]}
			slots={{
				notificationSetup: (
					<div ref={root}>
						{collapsed && (
							<p
								className="notificationSetupMessage__summary"
								role="status"
							>
								<span>
									{t(
										'erstantwort.notificationSummary.label',
										{
											state: stateLabel
										}
									)}
								</span>
								<span aria-hidden> · </span>
								<Link
									component="button"
									type="button"
									variant="body2"
									ref={change}
									onClick={() => remember('expanded')}
									sx={{ verticalAlign: 'baseline' }}
								>
									{t(
										'erstantwort.notificationSummary.change'
									)}
								</Link>
							</p>
						)}
						{/* Hidden, not unmounted: an open browser dialog or a
						    half-finished "both" setup keeps its state. */}
						{/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
						<div
							hidden={collapsed}
							onClickCapture={(event) => {
								if (
									(event.target as Element).closest?.(
										'.notificationChoiceCard__option--both'
									)
								)
									setBothPending(true);
							}}
						>
							<div className="notificationSetupMessage__head">
								<div className="notificationSetupMessage__copy">
									{copy}
								</div>
								<IconButton
									ref={dismiss}
									aria-label={t(
										'erstantwort.notificationSummary.dismiss'
									)}
									onClick={() => {
										setBothPending(false);
										remember('collapsed');
									}}
									sx={{
										'flexShrink': 0,
										'width': 44,
										'height': 44,
										'color': 'var(--m3-on-surface-variant)',
										'& svg': { width: 20, height: 20 }
									}}
								>
									<CloseIcon aria-hidden focusable="false" />
								</IconButton>
							</div>
							<NotificationSetup
								isEmailEnabled={isEmailEnabled}
								isBrowserEnabled={isBrowserEnabled}
								onStart={onStart}
							/>
						</div>
					</div>
				)
			}}
		/>
	);
};
