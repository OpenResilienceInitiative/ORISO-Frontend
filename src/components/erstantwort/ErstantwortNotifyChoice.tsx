import * as React from 'react';
import {
	ERSTANTWORT_NOTIFY_COPY,
	notifyText,
	type ErstantwortNotifyTranslate
} from './erstantwortNotifyCopy';
import './ErstantwortNotifyChoice.styles.scss';

/**
 * **Modul 2 — „Wie sollen wir Sie erreichen?"** as its own Carimat message
 * (ADR-018, ORISO-Frontend#825, Franks Anforderung 07.09.2026).
 *
 * Two channels offered as equals, each with **its own button**, plus the
 * recommended combination underneath. Proposal only — this molecule is rendered
 * from `ErstantwortModul2.stories.tsx` and from nowhere else; no app path
 * imports it. Full analysis:
 * `0 - Docs/VERDRAHTUNG-modul2-benachrichtigung-2026-09-07.md`.
 *
 * <h3>Why not `NotificationChoiceCard`, which already exists</h3>
 *
 * That card was the starting point and three of its decisions carry over
 * verbatim: stacked full-width targets (the reference user is older and on a
 * phone), the honest hint that a browser signal reaches one device only, and
 * the refusal to claim knowledge the platform does not have. Four things made
 * it the wrong shape for what Frank asked for on 07.09.:
 *
 * 1. **Its third option is not a combination, it is a bundle.** „Beides, und
 *    Passwort jetzt selbst festlegen" folds the credential decision into the
 *    notification decision. Credential saving is `saveCredentials` — a
 *    different Baustein with a different card. The recommended combination here
 *    is *both notification channels* and nothing else.
 * 2. **The whole option is the button.** Frank asked for two equal options
 *    "mit je einem Button", i.e. a labelled option that *carries* a button, so
 *    a channel with nothing left to press can still show its text.
 * 3. **It cannot express an outcome.** `chosen` is one enum for the entire
 *    card; there is no way to say "e-mail is on file, browser is still open".
 *    Every state variant Frank asked to see needs per-channel status.
 * 4. **It has no concept of a blocked browser.** See below — that is the case
 *    missing from the product today, and it is the one that must never render
 *    a button.
 *
 * <h3>Unsupported hides, blocked stays</h3>
 *
 * `unsupported` removes the option entirely: nothing the person can do changes
 * a browser that has no Notification API, and an explanation of an
 * impossibility is noise in a message someone reads right after writing about
 * something hard. (The house rule "disable, never hide" is about permissions
 * inside the product; this is a capability of the device.)
 *
 * `blocked` keeps the option and **replaces the button with a sentence**.
 * `Notification.requestPermission()` resolves straight to `denied` on a blocked
 * origin and shows no prompt at all — the shipped `requestPermissions()` does
 * not even call it (`utils/notificationHelpers.ts:62–64`: it only asks while
 * the permission is `default`). A button here would be the one thing this
 * sequence must never do: render enabled and do nothing.
 */

export type ErstantwortNotifyChoiceValue = 'EMAIL' | 'BROWSER' | 'BOTH';

/**
 * What the browser can do right now. Derived at render time, never stored —
 * ADR-018 §4 ("frozen words, live state").
 *
 * - `available` — `Notification.permission === 'default'`, we may ask.
 * - `granted` — already allowed on this device.
 * - `blocked` — `'denied'`. We cannot ask again; only the person can undo it.
 * - `unsupported` — no Notification API at all (`isSupported()` false).
 */
export type ErstantwortNotifyBrowserState =
	| 'available'
	| 'granted'
	| 'blocked'
	| 'unsupported';

export interface ErstantwortNotifyChoiceProps {
	/**
	 * Whether the e-mail action is still open. In the sequence this is not a
	 * second source of truth: it is `Boolean(baustein.action)` after
	 * `erstantwortResolve` has run, and `isActionStillOpen` has already dropped
	 * the action once an address is on file.
	 */
	isEmailOpen: boolean;
	browserState: ErstantwortNotifyBrowserState;
	/** No handler, no button — the rule `ErstantwortSequence` already follows. */
	onChoose?: (choice: ErstantwortNotifyChoiceValue) => void;
	/**
	 * Injected rather than resolved here, because none of these keys exists in
	 * `de/common.json` yet — see `erstantwortNotifyCopy.ts`. Same shape as
	 * `ErstantwortFaqGroup`'s.
	 */
	translate?: ErstantwortNotifyTranslate;
}

const Option: React.FC<{
	channel: string;
	label: string;
	hint: string;
	children: React.ReactNode;
	recommended?: boolean;
	badge?: string;
}> = ({ channel, label, hint, children, recommended = false, badge }) => (
	<div
		className={`erstantwortNotify__option${
			recommended ? ' erstantwortNotify__option--recommended' : ''
		}`}
		data-channel={channel}
	>
		{recommended && badge && (
			<span className="erstantwortNotify__badge">{badge}</span>
		)}
		<span className="erstantwortNotify__label">{label}</span>
		<span className="erstantwortNotify__hint">{hint}</span>
		{children}
	</div>
);

export const ErstantwortNotifyChoice: React.FC<
	ErstantwortNotifyChoiceProps
> = ({ isEmailOpen, browserState, onChoose, translate }) => {
	const text = (
		copy: (typeof ERSTANTWORT_NOTIFY_COPY)[keyof typeof ERSTANTWORT_NOTIFY_COPY]
	) => notifyText(copy, translate);

	const isBrowserOffered = browserState !== 'unsupported';
	const isBrowserOpen = browserState === 'available';
	/* The combination is only a real option while both halves are still open.
	   Offering "beides" to somebody who already has an e-mail on file would be
	   a button that does half of nothing. */
	const isCombinationOffered = isEmailOpen && isBrowserOpen;

	const button = (choice: ErstantwortNotifyChoiceValue, label: string) =>
		onChoose ? (
			<button
				type="button"
				className="erstantwortNotify__button"
				onClick={() => onChoose(choice)}
			>
				{label}
			</button>
		) : null;

	return (
		<div
			className="erstantwortNotify"
			data-testid="erstantwort-notify-choice"
			role="group"
			aria-label={text(ERSTANTWORT_NOTIFY_COPY.groupLabel)}
		>
			<Option
				channel="email"
				label={text(ERSTANTWORT_NOTIFY_COPY.emailLabel)}
				hint={text(ERSTANTWORT_NOTIFY_COPY.emailHint)}
			>
				{isEmailOpen ? (
					button('EMAIL', text(ERSTANTWORT_NOTIFY_COPY.emailAction))
				) : (
					<p className="erstantwortNotify__status erstantwortNotify__status--done">
						{text(ERSTANTWORT_NOTIFY_COPY.emailDone)}
					</p>
				)}
			</Option>

			{isBrowserOffered && (
				<Option
					channel="browser"
					label={text(ERSTANTWORT_NOTIFY_COPY.browserLabel)}
					hint={text(ERSTANTWORT_NOTIFY_COPY.browserHint)}
				>
					{isBrowserOpen &&
						button(
							'BROWSER',
							text(ERSTANTWORT_NOTIFY_COPY.browserAction)
						)}
					{browserState === 'granted' && (
						<p className="erstantwortNotify__status erstantwortNotify__status--done">
							{text(ERSTANTWORT_NOTIFY_COPY.browserDone)}
						</p>
					)}
					{browserState === 'blocked' && (
						<>
							{/* Two parts on purpose: the fact is flagged, the
							    way out is not shouted. Five lines in the error
							    role would read as a failure of the counselling
							    rather than as a browser setting. */}
							<p className="erstantwortNotify__status erstantwortNotify__status--blocked">
								{text(ERSTANTWORT_NOTIFY_COPY.browserBlocked)}
							</p>
							<span className="erstantwortNotify__hint">
								{text(
									ERSTANTWORT_NOTIFY_COPY.browserBlockedHelp
								)}
							</span>
						</>
					)}
				</Option>
			)}

			{isCombinationOffered && (
				<Option
					channel="both"
					recommended
					badge={text(ERSTANTWORT_NOTIFY_COPY.bothBadge)}
					label={text(ERSTANTWORT_NOTIFY_COPY.bothLabel)}
					hint={text(ERSTANTWORT_NOTIFY_COPY.bothHint)}
				>
					{button('BOTH', text(ERSTANTWORT_NOTIFY_COPY.bothAction))}
				</Option>
			)}
		</div>
	);
};
