import * as React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Switch } from '../Switch';
import { CaseHandoverSystemMessageCard } from './CaseHandoverClientCards';
import '../message/message.styles.scss';
import './caseHandoverClientCards.styles.scss';
import './handoverConsentElement.styles.scss';

/**
 * Post-acceptance consent element for the case-handover look-in (Frank,
 * 2026-09-07). It appears **after a Beratungsstelle has accepted the case**
 * and carries three things: an explanatory sentence, the two legal links of
 * that Beratungsstelle (Impressum + Datenschutzerklärung), and one switch
 * whose meaning is spelled out by a sentence underneath it.
 *
 * STORYBOOK ONLY — nothing here is wired to the app. Two questions have to be
 * answered before it can be, and the component is deliberately shaped so the
 * stories can show both answers side by side:
 *
 * 1. **What does the switch mean?** The two sentences Frank supplied are not
 *    complements of each other; read literally both of them permit look-in.
 *    See `HandoverConsentWording` below and
 *    `VERDRAHTUNG-modul4-handover-consent-2026-09-07.md`.
 * 2. **Which position is the privacy-friendly default?** That answer flips
 *    with the answer to (1), and so does whether "Opt-in ⇒ switch off" is
 *    correct or backwards.
 *
 * ADR boundaries this element must not cross:
 * - **ADR-022 decision 1 — exactly two gates, no third.** The explanatory
 *   text plus the two Beratungsstelle links *is* the content of gate 2, which
 *   `AnonymousConsentGate` already renders. This element is therefore rendered
 *   as an ordinary Carimat system message inside the stream, never as a modal
 *   and never blocking: a blocking third surface would be a third gate.
 * - **ADR-021 decision 7 — the imprint is an information duty, never a
 *   consent gate.** The Impressum link is a link, never part of the switch.
 * - **ADR-002 — membership is not visibility.** Colleagues are already silent
 *   room members from room creation and the curtain is access control, not
 *   cryptography. The copy therefore talks about *Einsicht nehmen* (the
 *   deliberate, audited reveal) and never promises technical unreadability.
 */

/**
 * Which of the three possible meanings of the switch this instance renders.
 *
 * - `AS_SPECIFIED` — Frank's two sentences verbatim, attached to the states he
 *   attached them to. Kept so the ambiguity is visible rather than smoothed
 *   over: in this variant *both* positions read as "look-in is permitted".
 * - `GRANT_ACCESS` — the switch *is* the consent. On = look-in permitted.
 *   This matches the shipped `CaseHandoverConsentCard` OPT_OUT surface and it
 *   is the reading under which "Träger set to opt-in ⇒ switch starts off" is
 *   correct (no pre-ticked consent, GDPR Art. 4(11)/Art. 7(2)).
 * - `REQUIRE_ASKING` — the switch is a demand to be asked. On = "ask me every
 *   time" (the protective position). This is the reading under which Frank's
 *   *off* sentence is exactly right — and under which "opt-in ⇒ off" would
 *   make the least protective position the default, against Art. 25(2).
 */
export type HandoverConsentWording =
	| 'AS_SPECIFIED'
	| 'GRANT_ACCESS'
	| 'REQUIRE_ASKING';

/** The Träger-level preselection this Beratungsstelle inherits. */
export type HandoverConsentTenantDefault = 'OPT_IN' | 'OPT_OUT';

/** Loading state of the two Beratungsstelle legal links. */
export type HandoverConsentLinksStatus = 'ready' | 'loading' | 'unavailable';

/**
 * Frank's rule, implemented literally: "a switch which, if set to opt-in in
 * the settings, is off".
 *
 * It is deliberately *not* corrected per wording variant. Under
 * `GRANT_ACCESS` this yields the privacy-friendly default; under
 * `REQUIRE_ASKING` the very same rule yields the privacy-hostile one. Seeing
 * that difference in two screenshots is the point of the stories.
 */
export const initialHandoverConsentState = (
	tenantDefault: HandoverConsentTenantDefault
): boolean => tenantDefault === 'OPT_OUT';

interface HandoverConsentElementProps {
	/** Name of the accepting Beratungsstelle, used in the explanatory copy. */
	agencyName?: string;
	/**
	 * Absolute URL of that Beratungsstelle's Impressum.
	 *
	 * Note this is *not* how the product resolves a Beratungsstelle document
	 * today: `LegalLinksProvider` only carries deployment-wide URLs
	 * (`REACT_APP_LEGAL_IMPRINT_URL` / `REACT_APP_LEGAL_PRIVACY_URL`), while the
	 * department text comes back as a *body* from
	 * `GET /service/agencies/{agencyId}/topics/{topicId}/legal` and is shown in
	 * `LegalLinkModal`. Pass `onOpenDocument` for that shape.
	 */
	imprintUrl?: string;
	/** Absolute URL of that Beratungsstelle's Datenschutzerklärung. */
	privacyUrl?: string;
	/**
	 * Opens the document in the shared legal reader instead of navigating.
	 * Takes precedence over the URL props — this is the shape the real
	 * department legal texts have.
	 */
	onOpenDocument?: (document: 'imprint' | 'privacy') => void;
	/**
	 * `loading` while the department legal texts are still being fetched,
	 * `unavailable` when the resolution chain produced nothing. The links are
	 * never rendered as dead anchors — an imprint that does not resolve is a
	 * reachability defect (ADR-021 decision 7), not a cosmetic one.
	 */
	linksStatus?: HandoverConsentLinksStatus;
	/** Which reading of the switch to render. */
	wording?: HandoverConsentWording;
	/** Controlled switch position. */
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** `true` while the preference is being persisted. */
	saving?: boolean;
	/** Set when persisting failed; rendered as an alert with a retry action. */
	error?: string;
	onRetry?: () => void;
	/** Optional time for the bubble's rail; omitted renders no rail at all. */
	timestamp?: string;
}

let instanceCounter = 0;

export const HandoverConsentElement = ({
	agencyName,
	imprintUrl,
	privacyUrl,
	onOpenDocument,
	linksStatus = 'ready',
	wording = 'AS_SPECIFIED',
	checked,
	onChange,
	saving = false,
	error,
	onRetry,
	timestamp
}: HandoverConsentElementProps) => {
	const { t: translate } = useTranslation();

	/* Stable per instance so several of these can sit in one stream without
	   colliding ids — the aria wiring below is the whole point of the
	   component, so it must not depend on there being exactly one. */
	const [ids] = React.useState(() => {
		instanceCounter += 1;
		return {
			label: `handoverConsentLabel-${instanceCounter}`,
			description: `handoverConsentDescription-${instanceCounter}`
		};
	});

	const organisation =
		agencyName ||
		translate(
			'caseHandover.handoverConsent.agencyFallback',
			'dieser Beratungsstelle'
		);

	/* One table, three readings — kept together so the divergence is readable
	   in one place instead of scattered across ternaries. */
	const copy: Record<
		HandoverConsentWording,
		{ label: [string, string]; on: [string, string]; off: [string, string] }
	> = {
		AS_SPECIFIED: {
			label: [
				'caseHandover.handoverConsent.asSpecified.switchLabel',
				'Einsicht durch andere Berater:innen'
			],
			/* Frank, 2026-09-07, verbatim. Reads as a standing grant, not as a
			   request to be asked — which is why it does not contrast with the
			   off sentence below. */
			on: [
				'caseHandover.handoverConsent.asSpecified.on',
				'Ich möchte immer meine Erlaubnis erteilen, wenn andere Berater der gleichen Beratungsstelle Einsicht bekommen.'
			],
			off: [
				'caseHandover.handoverConsent.asSpecified.off',
				'Ich erlaube anderen Beratern dieser Beratungsstelle ohne meine Einwilligung Einsicht zu nehmen.'
			]
		},
		GRANT_ACCESS: {
			label: [
				'caseHandover.handoverConsent.grantAccess.switchLabel',
				'Einsicht erlauben'
			],
			on: [
				'caseHandover.handoverConsent.grantAccess.on',
				'Ich erlaube anderen Berater:innen dieser Beratungsstelle, in diese Beratung Einsicht zu nehmen.'
			],
			off: [
				'caseHandover.handoverConsent.grantAccess.off',
				'Ich erlaube keine Einsicht. Wer Einsicht nehmen möchte, muss mich vorher fragen.'
			]
		},
		REQUIRE_ASKING: {
			label: [
				'caseHandover.handoverConsent.requireAsking.switchLabel',
				'Vorher um Erlaubnis fragen'
			],
			on: [
				'caseHandover.handoverConsent.requireAsking.on',
				'Ich möchte jedes Mal vorher gefragt werden, bevor andere Berater:innen dieser Beratungsstelle Einsicht nehmen.'
			],
			off: [
				'caseHandover.handoverConsent.requireAsking.off',
				'Ich erlaube anderen Berater:innen dieser Beratungsstelle, ohne meine Einwilligung Einsicht zu nehmen.'
			]
		}
	};

	const active = copy[wording];
	const [stateKey, stateFallback] = checked ? active.on : active.off;

	const renderLink = (
		document: 'imprint' | 'privacy',
		href: string | undefined,
		key: string,
		fallback: string
	) => {
		const text = translate(key, fallback);
		if (linksStatus === 'loading') {
			return (
				<span
					className="handoverConsent__linkPlaceholder"
					data-testid={`handover-consent-link-loading-${key}`}
				>
					{text}
				</span>
			);
		}
		/* The real department text arrives as a body, not a location, so the
		   reader callback is the primary path and the href only the fallback
		   for a deployment-wide link. */
		if (linksStatus === 'ready' && onOpenDocument) {
			return (
				<button
					type="button"
					className="handoverConsent__link handoverConsent__linkButton"
					onClick={() => onOpenDocument(document)}
				>
					{text}
				</button>
			);
		}
		if (linksStatus === 'unavailable' || !href) {
			return (
				<span className="handoverConsent__linkMissing">
					{translate(
						'caseHandover.handoverConsent.links.unavailable',
						'{{document}} — zurzeit nicht abrufbar',
						{ document: text }
					)}
				</span>
			);
		}
		return (
			<a
				className="handoverConsent__link"
				href={href}
				target="_blank"
				rel="noopener noreferrer"
			>
				{text}
			</a>
		);
	};

	return (
		<div
			className="handoverConsent"
			data-testid="handover-consent-element"
			data-wording={wording}
		>
			<CaseHandoverSystemMessageCard
				title={translate('caseHandover.consent.sender', 'Carimat')}
				subtitle={translate(
					'caseHandover.consent.senderRole',
					'Quick Guide'
				)}
				timestamp={timestamp}
			>
				<p className="handoverConsent__copy">
					{translate(
						'caseHandover.handoverConsent.intro',
						'Ihre Anfrage wurde von {{organisation}} angenommen. Ab jetzt gelten für diese Beratung das Impressum und die Datenschutzerklärung dieser Beratungsstelle.',
						{ organisation }
					)}
				</p>

				<p
					className="handoverConsent__links"
					data-testid="handover-consent-links"
				>
					{renderLink(
						'imprint',
						imprintUrl,
						'caseHandover.handoverConsent.links.imprint',
						'Impressum der Beratungsstelle'
					)}
					{renderLink(
						'privacy',
						privacyUrl,
						'caseHandover.handoverConsent.links.privacy',
						'Datenschutzerklärung der Beratungsstelle'
					)}
				</p>

				<div
					className={clsx(
						'handoverConsent__switchRow',
						saving && 'handoverConsent__switchRow--busy'
					)}
				>
					{/*
					 * `aria-labelledby` rather than a `<label for>`: the shared
					 * `Switch` already wraps its input in its own (empty) label,
					 * so an second explicit label would give the control two
					 * associated labels — the `form-field-multiple-labels` axe
					 * violation. Pointing at the visible span names the control
					 * exactly once and stays programmatic.
					 */}
					<span
						className="handoverConsent__switchLabel"
						id={ids.label}
					>
						{translate(active.label[0], active.label[1])}
					</span>
					<Switch
						checked={checked}
						onChange={onChange}
						disabled={saving}
						aria-labelledby={ids.label}
						aria-describedby={ids.description}
						data-testid="handover-consent-switch"
					/>
				</div>

				{/*
				 * The sentence is both the switch's description and the only
				 * place the change is spelled out, so it announces itself.
				 * `role="status"` is the polite live region; without it a screen
				 * reader user hears "on"/"off" and never learns that the meaning
				 * of the two positions is not symmetric.
				 */}
				<p
					className="handoverConsent__stateLine"
					id={ids.description}
					role="status"
					data-testid="handover-consent-state-line"
				>
					{translate(stateKey, stateFallback)}
				</p>

				{saving && (
					<p
						className="handoverConsent__saving"
						data-testid="handover-consent-saving"
					>
						{translate(
							'caseHandover.handoverConsent.saving',
							'Einstellung wird gespeichert …'
						)}
					</p>
				)}

				{error && (
					<p
						className="handoverConsent__error"
						role="alert"
						data-testid="handover-consent-error"
					>
						{error}
						{onRetry && (
							<button
								type="button"
								className="handoverConsent__retry"
								onClick={onRetry}
							>
								{translate(
									'caseHandover.handoverConsent.retry',
									'Erneut versuchen'
								)}
							</button>
						)}
					</p>
				)}
			</CaseHandoverSystemMessageCard>
		</div>
	);
};
