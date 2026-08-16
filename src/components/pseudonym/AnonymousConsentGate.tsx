import React, { useEffect, useMemo, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useTranslation } from 'react-i18next';
import { sanitizeLegalHtml } from '../legalContent/legalHtmlSanitizer';
import htmlParser from '../../resources/scripts/util/htmlParser';
import './AnonymousConsentGate.styles.scss';

interface AnonymousConsentGateProps {
	/**
	 * HTML for the inline consent line — typically produced by `renderToString`
	 * over the shared `<LegalLinks>` component so the "Datenschutzbestimmung"
	 * text becomes a real anchor to the tenant's privacy policy.
	 *
	 * Rendered through the shared legal-HTML sanitizer, never raw: this is
	 * Gate 2 of ADR-022, and the sentence shown here becomes Träger-authored
	 * content (ADR-021 decision 4). See the block comment below.
	 */
	consentLabelHtml: string;
	/** Called when the user clicks "Ich bin einverstanden". */
	onAccept: () => void;
	/** `true` while the accept request is in flight. */
	busy?: boolean;
}

/** Shield-with-person icon from Figma (70x78 within a 100x100 box). */
const PrivacyShieldIcon: React.FC = () => (
	<svg
		width="76"
		height="84"
		viewBox="0 0 76 84"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M59.8833 61.6667C61.1417 60.3472 61.7708 58.7889 61.7708 56.9917C61.7708 55.1944 61.1417 53.6667 59.8833 52.4083C58.625 51.15 57.0972 50.5208 55.3 50.5208C53.5028 50.5208 51.9444 51.15 50.625 52.4083C49.3056 53.6667 48.6458 55.1944 48.6458 56.9917C48.6458 58.7889 49.3056 60.3472 50.625 61.6667C51.9444 62.9861 53.5028 63.6458 55.3 63.6458C57.0972 63.6458 58.625 62.9861 59.8833 61.6667ZM55.1562 76.6667C57.4826 76.6667 59.5833 76.1806 61.4583 75.2083C63.3333 74.2361 64.9306 72.8472 66.25 71.0417C64.4444 70.0694 62.6403 69.3403 60.8375 68.8542C59.0347 68.368 57.1597 68.125 55.2125 68.125C53.2653 68.125 51.3715 68.368 49.5312 68.8542C47.691 69.3403 45.9028 70.0694 44.1667 71.0417C45.4861 72.8472 47.066 74.2361 48.9062 75.2083C50.7465 76.1806 52.8299 76.6667 55.1562 76.6667ZM33.3333 83.4375C23.75 81.2153 15.7986 75.7812 9.47917 67.1354C3.15972 58.4896 0 48.5764 0 37.3958V12.5L33.3333 0L66.6667 12.5V40.625C65.6944 40.1389 64.6528 39.7049 63.5417 39.3229C62.4306 38.941 61.3889 38.6806 60.4167 38.5417V16.875L33.3333 6.875L6.25 16.875V37.3958C6.25 42.6736 7.10069 47.5347 8.80208 51.9792C10.5035 56.4236 12.6736 60.3299 15.3125 63.6979C17.9514 67.066 20.8681 69.8611 24.0625 72.0833C27.2569 74.3056 30.3472 75.9028 33.3333 76.875C33.75 77.7083 34.375 78.6458 35.2083 79.6875C36.0417 80.7292 36.7361 81.5278 37.2917 82.0833C36.6667 82.4306 36.0069 82.691 35.3125 82.8646C34.6181 83.0382 33.9583 83.2292 33.3333 83.4375ZM55.4687 83.4375C50.0868 83.4375 45.4861 81.5104 41.6667 77.6562C37.8472 73.8021 35.9375 69.2361 35.9375 63.9583C35.9375 58.5118 37.8469 53.8687 41.6656 50.0292C45.4844 46.1903 50.1028 44.2708 55.5208 44.2708C60.8681 44.2708 65.4688 46.1903 69.3229 50.0292C73.1771 53.8687 75.1042 58.5118 75.1042 63.9583C75.1042 69.2361 73.1771 73.8021 69.3229 77.6562C65.4688 81.5104 60.8507 83.4375 55.4687 83.4375Z"
			fill="#1C1B1F"
		/>
	</svg>
);

const RejectXIcon: React.FC = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z"
			fill="#E7EFFC"
		/>
	</svg>
);

const AcceptCheckIcon: React.FC = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M10 16.4L6 12.4L7.4 11L10 13.6L16.6 7L18 8.4L10 16.4Z"
			fill="white"
		/>
	</svg>
);

/**
 * First-screen consent gate for anonymous askers — the "Herzlich Willkommen"
 * dialog shown before they can move on to the pseudonym picker. Strict
 * match for Figma: shield+title, body copy, bold cookies/privacy line, and
 * a right-justified pair of buttons (reject dark-grey, accept red).
 *
 * Rejection surfaces an inline warning instead of navigating away — the
 * asker can still click accept after reading it.
 */
const TITLE_ID = 'anonymousConsentGateTitle';
const DESCRIPTION_ID = 'anonymousConsentGateDescription';

export const AnonymousConsentGate: React.FC<AnonymousConsentGateProps> = ({
	consentLabelHtml,
	onAccept,
	busy = false
}) => {
	const { t } = useTranslation();
	const [rejected, setRejected] = useState(false);
	const rejectLabel = t(
		'anonymousChat.consent.reject',
		'Ich stimme nicht zu'
	);
	const dialogRef = useRef<HTMLDivElement | null>(null);

	/* ADR-022 "Blocking dependency" / ORISO-UserService#927.
	   This line used to go straight into `dangerouslySetInnerHTML`. That was
	   survivable only as long as the input was bundle i18n text plus anchors
	   this frontend generated itself. Gate 2 changes the input: the sentence
	   becomes a field of the Beratungsstelle's data-protection policy, authored
	   in the Admin by the Träger (ADR-021 decision 4) and delivered by the
	   backend. From that moment an unsanitised sink here is a stored-XSS hole
	   in the one dialog a help-seeker cannot get past.
	   The fix is not a second, bespoke allowlist but the one every other piece
	   of authored legal HTML already uses — `sanitizeLegalHtml` shared with
	   `LegalContentRenderer`. `a[href,target,rel]` stays allowed, so the link
	   to the policy keeps working; `<script>` and `on*` handlers do not
	   survive. `htmlParser` replaces the raw-HTML sink entirely and applies the
	   same tenant-media URL rewriting as the legal renderer. */
	const consentLabelNodes = useMemo(
		() => htmlParser(sanitizeLegalHtml(consentLabelHtml)),
		[consentLabelHtml]
	);

	/* Explicit initial focus alongside the trap. focus-trap-react resolves its
	   own `initialFocus` only once it considers the tree tabbable, which does
	   not hold in jsdom — so relying on it alone would leave the very behaviour
	   this exists for untested in CI. The trap still owns *containment*. */
	useEffect(() => {
		dialogRef.current?.focus();
	}, []);

	/* ORISO-UserService#927. The gate declares itself a modal dialog, and since
	   `SessionItemComponent` renders it *instead of* the conversation with the
	   composer hidden, that is accurate — what was missing is what makes the
	   claim true for a screen reader: a name, a description, and focus that is
	   actually *contained* in the thing the person cannot leave.
	   Moving focus in on mount was not enough: a keyboard user could still Tab
	   straight out of an `aria-modal` dialog into content the attribute claims
	   is inert. `FocusTrap` is the same primitive the platform `Overlay` uses,
	   so the behaviour matches every other dialog rather than being bespoke. */
	return (
		<FocusTrap
			focusTrapOptions={{
				/* The dialog container itself, not the heading: an <h2> is not
				   focusable, and landing on the container is what makes a
				   screen reader announce the dialog's name and description
				   before anything else. */
				/* Handled explicitly above, so the behaviour is testable. */
				initialFocus: false,
				// The gate has no dismiss affordance — consent is the only way
				// forward — so Escape must not appear to close it.
				escapeDeactivates: false,
				fallbackFocus: `.anonymousConsentGate`
			}}
		>
			<div
				className="anonymousConsentGate"
				role="dialog"
				aria-modal="true"
				aria-labelledby={TITLE_ID}
				aria-describedby={DESCRIPTION_ID}
				tabIndex={-1}
				ref={dialogRef}
			>
				<div className="anonymousConsentGate__card">
					<div className="anonymousConsentGate__header">
						<span
							className="anonymousConsentGate__icon"
							aria-hidden="true"
						>
							<PrivacyShieldIcon />
						</span>
						<h2
							className="anonymousConsentGate__title"
							id={TITLE_ID}
						>
							{t(
								'anonymousConsent.headline',
								'Herzlich Willkommen'
							)}
						</h2>
					</div>

					<p
						className="anonymousConsentGate__body"
						id={DESCRIPTION_ID}
					>
						{t(
							'anonymousConsent.description',
							'Danach kann eine beratende Person einen Chat mit Ihnen beginnen.'
						)}
					</p>

					<p className="anonymousConsentGate__consent">
						{consentLabelNodes}
					</p>

					{rejected && (
						<p
							className="anonymousConsentGate__rejectedNotice"
							role="alert"
						>
							{t(
								'anonymousChat.consent.mustAcceptToContinue',
								'Um fortzufahren müssen Sie unseren Datenschutzbestimmungen zustimmen.'
							)}
						</p>
					)}

					<div className="anonymousConsentGate__actions">
						{/* Icon-only per the design (CAR02 2183-14718). The label
						    still exists — as the accessible name and the tooltip
						    — because a bare ✕ says nothing to a screen reader,
						    and because the two labelled buttons were what pushed
						    this row out of the card at 375px (#892). */}
						<button
							type="button"
							className="anonymousConsentGate__btnReject"
							onClick={() => setRejected(true)}
							disabled={busy}
							aria-label={rejectLabel}
							title={rejectLabel}
						>
							<RejectXIcon />
						</button>
						<button
							type="button"
							className="anonymousConsentGate__btnAccept"
							onClick={onAccept}
							disabled={busy}
						>
							<AcceptCheckIcon />
							<span>
								{t(
									'anonymousChat.consent.accept',
									'Ich bin einverstanden'
								)}
							</span>
						</button>
					</div>
				</div>
			</div>
		</FocusTrap>
	);
};
