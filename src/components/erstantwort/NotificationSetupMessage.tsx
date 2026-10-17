import * as React from 'react';
import {
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';
import { IconButton, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import { ErstantwortSequence } from './ErstantwortSequence';
import { NotificationSetup } from './NotificationSetup';
import { useNotificationChannels } from './useNotificationChannels';
import {
	readNotificationSetupDismissed,
	writeNotificationSetupDismissed
} from './notificationSetupCollapseState';
import './NotificationSetupMessage.styles.scss';

interface NotificationSetupCollapseProps {
	/**
	 * Id of the chat message this setup sits in. Pass it only where the setup
	 * is really part of the history and renders again after a reload: it lets
	 * an X survive a reload. Without it the X lasts while the message is on
	 * screen.
	 */
	messageId?: string;
	/**
	 * The person opened this setup on purpose (a "set up notifications"
	 * button): show it in full even if a channel is already active.
	 */
	startOpen?: boolean;
	/**
	 * The suggestion is specifically the consent e-mail (re-assignment
	 * notices): only that e-mail completes it. Regular message e-mails or a
	 * browser channel alone leave the suggestion in full, as before.
	 */
	requireConsentEmail?: boolean;
	isEmailEnabled?: boolean;
	isBrowserEnabled?: boolean;
	/** Short copy above the choices; shown with them, gone when collapsed. */
	copy?: React.ReactNode;
	onStart?: () => void;
}

interface NotificationSetupMessageProps extends NotificationSetupCollapseProps {
	/** Sender subtitle in the kicker line; defaults to the Erstantwort one. */
	subtitle?: string;
}

type ActiveChannels = 'none' | 'email' | 'browser' | 'both';

/**
 * The setup inside a message bubble: the full choice while the person still
 * has something to do, one quiet line ("Benachrichtigung: E-Mail aktiv ·
 * ändern") once a channel is reachable or they pressed the X.
 *
 * Collapse follows the account first: a reachable channel collapses the card.
 * The only thing remembered is an explicit X. "ändern" always wins: it opens
 * the setup and clears a remembered X, so a card the person asked for is never
 * hidden by something stale.
 *
 * The setup keeps running while collapsed (it is hidden, not unmounted), so a
 * browser dialog or a half-finished "both" setup is never torn down.
 */
export const NotificationSetupCollapse = ({
	messageId,
	startOpen = false,
	requireConsentEmail = false,
	isEmailEnabled = true,
	isBrowserEnabled = true,
	copy,
	onStart
}: NotificationSetupCollapseProps) => {
	const { t } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const accountId = userData?.userId;
	const {
		emailActive: messageEmailActive,
		consentEmailActive,
		browserActive,
		browserSilenced
	} = useNotificationChannels(isEmailEnabled, isBrowserEnabled);
	const emailActive = requireConsentEmail
		? consentEmailActive
		: messageEmailActive;
	// A silenced browser does not reach anyone: the setup stays in full.
	const browserReachable = browserActive && !browserSilenced;
	const active: ActiveChannels =
		emailActive && browserReachable
			? 'both'
			: emailActive
				? 'email'
				: browserReachable
					? 'browser'
					: 'none';

	const [dismissed, setDismissed] = useState(() =>
		messageId ? readNotificationSetupDismissed(accountId, messageId) : false
	);
	// Opened on purpose (startOpen or "ändern"): wins over the account state
	// until a channel is chosen.
	const [opened, setOpened] = useState(startOpen);
	// "Set up both" is two steps; the message waits for the second one.
	const [bothPending, setBothPending] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const change = useRef<HTMLButtonElement>(null);
	const close = useRef<HTMLButtonElement>(null);
	const focusChangeNext = useRef(false);
	const focusSetupNext = useRef(false);

	// Another message or another account in the same mounted tree.
	useEffect(() => {
		setDismissed(
			messageId
				? readNotificationSetupDismissed(accountId, messageId)
				: false
		);
		setBothPending(false);
	}, [accountId, messageId]);

	// What ends the card's job: any reachable channel, or for the consent
	// suggestion the consent e-mail itself.
	const done = requireConsentEmail ? emailActive : active !== 'none';
	const collapsed = !opened && (dismissed || (done && !bothPending));

	const noteFocus = (toSummary: boolean) => {
		const focusInside = !!root.current?.contains(document.activeElement);
		focusChangeNext.current = toSummary && focusInside;
		focusSetupNext.current = !toSummary && focusInside;
	};

	const seenActive = useRef(active);
	useEffect(() => {
		const changed = seenActive.current !== active;
		seenActive.current = active;
		const bothDone = bothPending && active === 'both';
		if (bothDone) setBothPending(false);
		// A channel chosen while the setup was open collapses it again. A setup
		// that was merely opened while a channel was already active stays open.
		// The end of "set up both" counts as that choice, even though the
		// channel changed one step earlier while the message was still waiting.
		if (opened && done && (bothDone || (changed && !bothPending))) {
			noteFocus(true);
			setOpened(false);
		}
	}, [active, done, bothPending, opened]);

	// Any collapse (the X, a chosen channel, an account change) moves keyboard
	// focus to "ändern" when it was inside the card, before the browser drops
	// it with the hidden choices.
	// A choice disables the options while it saves, so the browser may already
	// have dropped focus to the body when the collapse arrives: remember whether
	// focus was last in the card, until the person focuses or clicks elsewhere.
	const focusLastInCard = useRef(false);
	useEffect(() => {
		const track = (event: Event) => {
			focusLastInCard.current = !!root.current?.contains(
				event.target as Node
			);
		};
		document.addEventListener('focusin', track);
		document.addEventListener('pointerdown', track);
		return () => {
			document.removeEventListener('focusin', track);
			document.removeEventListener('pointerdown', track);
		};
	}, []);
	const wasCollapsed = useRef(collapsed);
	useLayoutEffect(() => {
		const justCollapsed = collapsed && !wasCollapsed.current;
		wasCollapsed.current = collapsed;
		const active = document.activeElement;
		const focusDropped = !active || active === document.body;
		if (
			justCollapsed &&
			(focusChangeNext.current ||
				root.current?.contains(active) ||
				(focusDropped && focusLastInCard.current))
		) {
			focusChangeNext.current = false;
			change.current?.focus();
		}
	}, [collapsed]);
	useEffect(() => {
		// "ändern" is unmounted when the setup opens; keep keyboard focus inside the message.
		if (!collapsed && focusSetupNext.current) {
			focusSetupNext.current = false;
			close.current?.focus();
		}
	}, [collapsed]);

	const reopen = () => {
		noteFocus(false);
		setDismissed(false);
		if (messageId) {
			writeNotificationSetupDismissed(accountId, messageId, false);
		}
		setOpened(true);
	};
	const dismiss = () => {
		noteFocus(true);
		setBothPending(false);
		setOpened(false);
		setDismissed(true);
		if (messageId) {
			writeNotificationSetupDismissed(accountId, messageId, true);
		}
	};

	const stateLabel = t(`erstantwort.notificationSummary.${active}`);

	return (
		<div ref={root}>
			{/* Always mounted: a live region that appears together with its
			    text is announced unreliably. */}
			<div
				aria-live="polite"
				aria-atomic="true"
				data-cy="notification-setup-summary-region"
			>
				{collapsed && (
					<p className="notificationSetupMessage__summary">
						<span>
							{t('erstantwort.notificationSummary.label', {
								state: stateLabel
							})}
						</span>
						<span aria-hidden> · </span>
						<Link
							component="button"
							type="button"
							variant="body2"
							ref={change}
							aria-label={t(
								'erstantwort.notificationSummary.changeLabel'
							)}
							onClick={reopen}
							sx={{ verticalAlign: 'baseline' }}
						>
							{t('erstantwort.notificationSummary.change')}
						</Link>
					</p>
				)}
			</div>
			{/* Hidden, not unmounted: an open browser dialog or a
			    half-finished "both" setup keeps its state. */}
			{/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
			<div
				hidden={collapsed}
				onClickCapture={(event) => {
					// Only a click on "both" starts the two-step flow. Any other
					// choice (also after a cancelled "both") ends the wait.
					const option = (event.target as Element).closest?.(
						'.notificationChoiceCard__option'
					);
					if (option)
						setBothPending(
							option.classList.contains(
								'notificationChoiceCard__option--both'
							)
						);
				}}
			>
				<div className="notificationSetupMessage__head">
					<div className="notificationSetupMessage__copy">{copy}</div>
					<IconButton
						ref={close}
						aria-label={t(
							'erstantwort.notificationSummary.dismiss'
						)}
						onClick={dismiss}
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
	);
};

/** A stand-alone setup message: the Carimat bubble around the setup. */
export const NotificationSetupMessage = ({
	subtitle,
	...setup
}: NotificationSetupMessageProps) => (
	<ErstantwortSequence
		skipAnimation
		subtitle={subtitle}
		bausteine={[{ id: 'notificationSetup', headline: '', body: '' }]}
		slots={{
			notificationSetup: <NotificationSetupCollapse {...setup} />
		}}
	/>
);
