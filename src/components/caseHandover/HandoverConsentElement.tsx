import * as React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ReactComponent as ImprintIcon } from '../../resources/img/icons/imprint.svg';
import { ReactComponent as PrivacyIcon } from '../../resources/img/icons/privacy-policy.svg';
import { ReactComponent as EyeIcon } from '../../resources/img/icons/eye.svg';
import { Switch } from '../Switch';
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';
import type { ResolvedBaustein } from '../erstantwort/erstantwortResolve';
import './handoverConsentElement.styles.scss';

/**
 * Modul 4 — the handover-consent element, rebuilt after Frank's clarification
 * of 2026-09-07.
 *
 * <h3>What the thing actually is</h3>
 *
 * The help-seeker is asked, up front, whether they agree that other counsellors
 * of the same Beratungsstelle may uncover their case. There are exactly three
 * operating modes, and which one applies is decided by the Beratungsstelle:
 *
 * | Mode | Switch starts | What the person has to do |
 * |---|---|---|
 * | `OPT_IN`  | **off** | set it themselves if they agree not to be asked again |
 * | `OPT_OUT` | **on**  | switch it off themselves if they want to be asked every time |
 * | `MUTED`   | — | nothing; the Beratungsstelle turned the choice off, so no switch is rendered |
 *
 * <h3>The finding that made the old version wrong</h3>
 *
 * `OPT_IN` and `OPT_OUT` do **not** give the switch two different meanings.
 * In both modes the switch means the same thing —
 *
 * - **on** = they may read along without asking,
 * - **off** = they must ask first —
 *
 * and the mode decides nothing but the **starting position**. The previous
 * build carried three competing "wordings" for that reason; there is only one.
 * The two sentences underneath are recognisable opposites — they open
 * identically and part exactly where the meaning parts
 * ("… dürfen mitlesen, ohne Sie zu fragen" ↔ "… dürfen erst mitlesen, wenn Sie
 * Ja sagen"), which the originally specified pair was not: both of those
 * permitted look-in.
 *
 * <h3>Plain-language pass of 2026-09-07, evening</h3>
 *
 * Frank kept the copy but asked for it "a tick simpler", above all in the
 * consent fields. Nothing the text *says* changed; the sentences were cut to
 * one thought each and the administrative nouns were dropped —
 * "technisch Zugang" → "Zugang", "protokolliert" → "notiert",
 * "ohne Nachfrage" → "ohne zu fragen", "Diesen Bedingungen … zugestimmt" →
 * "Dazu … Ja gesagt". Measured German: average sentence 8.7 → 7.7 words,
 * longest 17 → 11, words over three syllables 6 → 4 — and the remaining four
 * are the irreducible terms (Beratende, Beratungsstelle, Datenschutzerklärung).
 * The three honest claims of ADR-002 survive the cut untouched. The five
 * other locales were re-translated from the *new* German, not patched from the
 * old one.
 *
 * <h3>What the copy is not allowed to claim</h3>
 *
 * ADR-002: colleagues of the Beratungsstelle are **real silent room members
 * from room creation**, and the curtain is access control plus audit, *not*
 * cryptography ("no cryptographic confidentiality between counsellors of the
 * same agency"). A sentence promising that nobody else *could* read would be
 * untrue. The copy therefore says the access exists technically, and the
 * switch governs the deliberate, logged reading — nothing else.
 *
 * <h3>ADR-022 decision 1 — exactly two gates, no third</h3>
 *
 * This is an ordinary Carimat message in the stream, like its sibling modules:
 * never modal, never blocking, always skippable. A blocking surface here would
 * be a third gate.
 *
 * STORYBOOK ONLY. Nothing is wired: there is no endpoint and no field for a
 * *standing* preference, and the three modes do not exist in the real
 * configuration either — see
 * `0 - Docs/VERDRAHTUNG-modul4-handover-consent-2026-09-07.md`.
 */

/** Which of the three operating modes the Beratungsstelle has configured. */
export type HandoverConsentMode = 'OPT_IN' | 'OPT_OUT' | 'MUTED';

/** Loading state of the two Beratungsstelle legal links. */
export type HandoverConsentLinksStatus = 'ready' | 'loading' | 'unavailable';

/**
 * Frank's rule, and the only thing the mode decides: opt-in starts off,
 * opt-out starts on. `MUTED` never reaches a switch, so it has no position —
 * `false` is returned only so callers get a total function.
 */
export const initialHandoverConsentState = (
	mode: HandoverConsentMode
): boolean => mode === 'OPT_OUT';

/** Whether this mode renders a switch at all. */
export const handoverConsentIsDecidable = (
	mode: HandoverConsentMode
): boolean => mode !== 'MUTED';

interface HandoverConsentControlsProps {
	mode: HandoverConsentMode;
	/**
	 * Absolute URL of the Beratungsstelle's Impressum.
	 *
	 * Note this is *not* how a Beratungsstelle document resolves today:
	 * `LegalLinksProvider` only carries deployment-wide URLs, while the
	 * department text arrives as a *body* from
	 * `GET /service/agencies/{agencyId}/topics/{topicId}/legal` and is read in
	 * `LegalLinkModal`. Pass `onOpenDocument` for that shape.
	 */
	imprintUrl?: string;
	/** Absolute URL of the Beratungsstelle's Datenschutzerklärung. */
	privacyUrl?: string;
	/**
	 * Opens the document in the shared legal reader instead of navigating.
	 * Takes precedence over the URL props — this is the shape the real
	 * department legal texts have.
	 */
	onOpenDocument?: (document: 'imprint' | 'privacy') => void;
	/**
	 * `loading` while the department legal texts are still being fetched,
	 * `unavailable` when the resolution chain produced nothing. Links are never
	 * rendered as dead anchors: an imprint that does not resolve is a
	 * reachability defect (ADR-021 decision 7), not a cosmetic one.
	 */
	linksStatus?: HandoverConsentLinksStatus;
	/** Controlled switch position. Ignored in `MUTED`. */
	checked?: boolean;
	onChange?: (checked: boolean) => void;
	/** `true` while the preference is being persisted. */
	saving?: boolean;
	/** Set when persisting failed; rendered as an alert with a retry action. */
	error?: string;
	onRetry?: () => void;
}

let instanceCounter = 0;

/**
 * The part that lives **inside** the Carimat bubble: the two legal links, the
 * honest sentence about who already has access, and either the switch or —
 * in `MUTED` — the plain statement that the Beratungsstelle has decided this.
 */
export const HandoverConsentControls = ({
	mode,
	imprintUrl,
	privacyUrl,
	onOpenDocument,
	linksStatus = 'ready',
	checked = false,
	onChange,
	saving = false,
	error,
	onRetry
}: HandoverConsentControlsProps) => {
	const { t: translate } = useTranslation();

	/* Stable per instance so several of these can sit in one stream without
	   colliding ids — the aria wiring is the whole point of the control, so it
	   must not depend on there being exactly one on the page. */
	const [ids] = React.useState(() => {
		instanceCounter += 1;
		return {
			label: `handoverConsentLabel-${instanceCounter}`,
			description: `handoverConsentDescription-${instanceCounter}`
		};
	});

	const renderLink = (
		document: 'imprint' | 'privacy',
		Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>,
		href: string | undefined,
		key: string,
		fallback: string
	) => {
		const text = translate(key, fallback);
		const icon = <Icon className="handoverConsent__linkIcon" aria-hidden />;

		if (linksStatus === 'loading') {
			return (
				<span
					className="handoverConsent__linkRow handoverConsent__linkPlaceholder"
					data-testid={`handover-consent-link-loading-${document}`}
				>
					{icon}
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
					className="handoverConsent__linkRow handoverConsent__link handoverConsent__linkButton"
					onClick={() => onOpenDocument(document)}
					data-testid={`handover-consent-link-${document}`}
				>
					{icon}
					{text}
				</button>
			);
		}
		if (linksStatus === 'unavailable' || !href) {
			return (
				<span
					className="handoverConsent__linkRow handoverConsent__linkMissing"
					data-testid={`handover-consent-link-missing-${document}`}
				>
					{icon}
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
				className="handoverConsent__linkRow handoverConsent__link"
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				data-testid={`handover-consent-link-${document}`}
			>
				{icon}
				{text}
			</a>
		);
	};

	return (
		<div className="handoverConsent" data-mode={mode}>
			<div
				className="handoverConsent__links"
				data-testid="handover-consent-links"
			>
				{renderLink(
					'imprint',
					ImprintIcon,
					imprintUrl,
					'caseHandover.handoverConsent.links.imprint',
					'Impressum der Beratungsstelle'
				)}
				{renderLink(
					'privacy',
					PrivacyIcon,
					privacyUrl,
					'caseHandover.handoverConsent.links.privacy',
					'Datenschutzerklärung der Beratungsstelle'
				)}
			</div>

			{/*
			 * ADR-002 in one paragraph. It has to come before the switch,
			 * because without it the switch reads as "nobody can see this",
			 * which is exactly the promise the platform cannot keep.
			 */}
			<p
				className="handoverConsent__context"
				data-testid="handover-consent-context"
			>
				{translate(
					'caseHandover.handoverConsent.context',
					'Alle Beratenden dieser Beratungsstelle haben Zugang zu Ihrer Beratung. Sie lesen nur mit, wenn es einen Grund gibt. Zum Beispiel bei Krankheit, Urlaub oder einer Frage im Team. Jedes Mitlesen wird notiert.'
				)}
			</p>

			{mode === 'MUTED' ? (
				/*
				 * No switch, and no sentence pretending there is a choice. The
				 * message itself stays: the two legal documents are an
				 * information duty on every level (ADR-021 decision 7) and
				 * ADR-002 discloses silent membership through the Department
				 * DPP, so muting the *decision* must not mute the *disclosure*.
				 */
				<p
					className="handoverConsent__mutedNotice"
					data-testid="handover-consent-muted"
				>
					<EyeIcon
						className="handoverConsent__mutedIcon"
						aria-hidden
					/>
					<span>
						{translate(
							'caseHandover.handoverConsent.muted',
							'In dieser Beratungsstelle dürfen andere Beratende mitlesen, ohne Sie zu fragen. Dazu haben Sie bei der Anmeldung Ja gesagt. Mehr dazu steht in der Datenschutzerklärung oben.'
						)}
					</span>
				</p>
			) : (
				<>
					<div
						className={clsx(
							'handoverConsent__switchRow',
							saving && 'handoverConsent__switchRow--busy'
						)}
					>
						<EyeIcon
							className="handoverConsent__switchIcon"
							aria-hidden
						/>
						{/*
						 * `aria-labelledby` rather than a `<label for>`: the
						 * shared `Switch` already wraps its input in its own
						 * label, so a second explicit label would give the
						 * control two associated labels — the
						 * `form-field-multiple-labels` axe violation. Pointing
						 * at the visible span names it exactly once and stays
						 * programmatic.
						 */}
						<span
							className="handoverConsent__switchLabel"
							id={ids.label}
						>
							{translate(
								'caseHandover.handoverConsent.switchLabel',
								'Mitlesen ohne zu fragen'
							)}
						</span>
						<Switch
							checked={checked}
							onChange={(next) => onChange?.(next)}
							disabled={saving}
							aria-labelledby={ids.label}
							aria-describedby={ids.description}
							data-testid="handover-consent-switch"
						/>
					</div>

					{/*
					 * The sentence is both the switch's description and the
					 * only place its meaning is spelled out, so it announces
					 * itself. `role="status"` is the polite live region;
					 * without it a screen-reader user hears "on"/"off" and
					 * never learns what the two positions actually do.
					 */}
					<p
						className="handoverConsent__stateLine"
						id={ids.description}
						role="status"
						data-testid="handover-consent-state-line"
					>
						{checked
							? translate(
									'caseHandover.handoverConsent.on',
									'Andere Beratende dürfen mitlesen, ohne Sie zu fragen.'
								)
							: translate(
									'caseHandover.handoverConsent.off',
									'Andere Beratende dürfen erst mitlesen, wenn Sie Ja sagen.'
								)}
					</p>

					<p
						className="handoverConsent__hint"
						data-testid="handover-consent-hint"
					>
						{translate(
							'caseHandover.handoverConsent.hint',
							'Sie können das jederzeit wieder ändern.'
						)}
					</p>
				</>
			)}

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
		</div>
	);
};

interface HandoverConsentElementProps extends HandoverConsentControlsProps {
	/** Name of the accepting Beratungsstelle, used in the opening sentence. */
	agencyName?: string;
}

/**
 * Modul 4 as it appears in the conversation: a Carimat message of its own —
 * avatar, name, and a sub-line that says what to do now — with the controls
 * inside the bubble. Same shell as the sibling modules, so the four of them
 * read as one voice rather than four surfaces.
 */
export const HandoverConsentElement = ({
	agencyName,
	mode,
	...controls
}: HandoverConsentElementProps) => {
	const { t: translate } = useTranslation();

	const organisation =
		agencyName ||
		translate(
			'caseHandover.handoverConsent.agencyFallback',
			'Diese Beratungsstelle'
		);

	const baustein: ResolvedBaustein = {
		id: 'handoverConsent',
		body: translate(
			'caseHandover.handoverConsent.intro',
			'{{organisation}} hat Ihre Anfrage angenommen. Für diese Beratung gelten jetzt das Impressum und die Datenschutzerklärung dieser Beratungsstelle.',
			{ organisation }
		)
	};

	/*
	 * The sub-line is a call to action, not a category label ("Quick Guide"
	 * told the reader nothing). It differs by mode because the job differs:
	 * two of the modes ask for a decision, the third only asks to be read.
	 */
	const subtitle = handoverConsentIsDecidable(mode)
		? translate(
				'caseHandover.handoverConsent.subtitle.decide',
				'Bitte einmal entscheiden'
			)
		: translate(
				'caseHandover.handoverConsent.subtitle.read',
				'Bitte kurz lesen'
			);

	return (
		<div data-testid="handover-consent-element" data-mode={mode}>
			<ErstantwortSequence
				bausteine={[baustein]}
				skipAnimation
				subtitle={subtitle}
				slots={{
					handoverConsent: (
						<HandoverConsentControls mode={mode} {...controls} />
					)
				}}
			/>
		</div>
	);
};
