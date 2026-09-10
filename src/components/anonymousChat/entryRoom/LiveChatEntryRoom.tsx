import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { renderToString } from 'react-dom/server';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocaleContext } from '../../../globalState';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import LegalLinks from '../../legalLinks/LegalLinks';
import { apiGetAnonymousEnquiryDetails } from '../../../api/apiGetAnonymousEnquiryDetails';
import { apiGetConsentText } from '../../../api/apiGetConsentText';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { apiPutSessionConsent } from '../../../api/apiPutSessionConsent';
import { apiPutSessionData } from '../../../api/apiPutSessionData';
import {
	DepartmentConsentState,
	resolveEntryRoomConsent
} from './entryRoomConsent';
import { performLeaveQueueDelete } from '../../pseudonym/leaveQueueDelete';
import { toRegistrationUsername } from '../../registration/accountData/registrationUsername';
import { generatePseudonym } from '../../../utils/pseudonymGenerator';
import type { Pseudonym } from '../../../utils/anonName/engine';
import { buildInviteSessionAppUrl } from '../../invite/inviteLinkHelpers';
import { translateWithFallback } from '../../../utils/translationFallback';
import { EntryRoomShell } from './EntryRoomShell';
import { LiveChatAccess } from './LiveChatAccess';
import { LiveChatWaitingRoom } from './LiveChatWaitingRoom';
import { LiveChatClosed } from './LiveChatClosed';

export interface LiveChatEntryRoomProps {
	/** The anonymous session the invite link redeemed. Tokens are already set. */
	sessionId: number;
	/** The topic slug from the link, for the heading. */
	topicSlug?: string;
}

const POLL_MS = 4000;

/** How many names the door offers at once (Frank: „drei vier varianten"). */
const NAME_CHOICES = 4;

/**
 * One offer: the animal picture and the User-ID that goes with it.
 *
 * The door shows the **User-ID**, not the three-word display name (Frank,
 * 2026-09-10: „wichtig ist, dass wir die User IDs nutzen"). Two reasons. It is
 * the string the guest meets everywhere else in the app, so nothing is minted
 * behind their back; and the display name carried a grammar bug that four
 * names at once made unmissable — the engine appends the adjective without the
 * animal's gender („stilles Löwe"). A User-ID has no adjective and no umlaut:
 * `loewe_shin_4211`.
 */
export interface GuestName {
	identity: Pseudonym;
	/** `animal_name_1234`, umlauts spelled out — what the session stores. */
	userId: string;
}

/**
 * A fresh set of offers. The engine draws with replacement, so the same name
 * can come up twice in four draws; a set with a double in it looks like a bug,
 * hence the dedupe — on the User-ID, because that is what the guest compares.
 * The attempt cap keeps a small language pack from spinning here: a short set
 * is better than a hung door.
 */
const rollGuestNames = (locale: string): GuestName[] => {
	const picked: GuestName[] = [];
	const seen = new Set<string>();
	for (
		let attempt = 0;
		attempt < NAME_CHOICES * 10 && picked.length < NAME_CHOICES;
		attempt++
	) {
		const identity = generatePseudonym(locale);
		const userId = toRegistrationUsername(identity);
		if (seen.has(userId)) continue;
		seen.add(userId);
		picked.push({ identity, userId });
	}
	return picked;
};

/**
 * The live chat's entry room — the room before the chat.
 *
 * Replaces the gates that used to live inside `SessionItemComponent`
 * (consent dialog, pseudonym card, waiting-queue bar, closed modal) with one
 * page on the stage. The session component still owns the chat itself: this
 * room leaves the three per-session `sessionStorage` marks it reads
 * (`anonymous-pseudonym-*`, `anonymous-inquiry-consent-*`,
 * `anonymous-waiting-dismissed-*`) and the user-level consent flag on the
 * server, then hands over. Nothing about the chat is re-implemented here.
 *
 * State: `access` (a name) → `waiting` (poll every 4 s: people ahead,
 * available counsellors, status) → `accepted` (status IN_PROGRESS: consent
 * slides in) → hand-over. `closed` is a view of `waiting` while no
 * counsellor is available; it steps back the moment one is.
 */
export const LiveChatEntryRoom = ({
	sessionId,
	topicSlug
}: LiveChatEntryRoomProps) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const localeContext = useContext(LocaleContext);
	const locale = localeContext?.locale ?? 'de';
	const legalLinks = useContext(LegalLinksContext);
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `liveChat.entry.${key}`, fallback),
		[t]
	);

	const [stage, setStage] = useState<'access' | 'waiting'>('access');
	const [names, setNames] = useState<GuestName[]>(() =>
		rollGuestNames(locale)
	);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [busy, setBusy] = useState(false);
	const [ahead, setAhead] = useState<number | null>(null);
	const [available, setAvailable] = useState<number | null>(null);
	const [accepted, setAccepted] = useState(false);
	const [department, setDepartment] = useState<{
		agencyId: number;
		topicId: number;
	} | null>(null);
	const [closedDismissed, setClosedDismissed] = useState(false);
	const [leaveFailed, setLeaveFailed] = useState(false);
	const [continueFailed, setContinueFailed] = useState(false);
	const cancelled = useRef(false);
	useEffect(
		() => () => {
			cancelled.current = true;
		},
		[]
	);

	const topicName = useMemo(
		() =>
			topicSlug
				? decodeURIComponent(topicSlug).replace(/-/g, ' ').trim()
				: '',
		[topicSlug]
	);
	const kicker = topicName
		? `${tr('kicker', 'Live-Chat')} · ${topicName}`
		: tr('kicker', 'Live-Chat');

	/* The link markup the sentence's `{{legal_links}}` token is replaced with.
	   The backend cannot render it: the targets come from this frontend's
	   deployment configuration (ADR-021 decision 5). */
	const legalLinksHtml = useMemo(
		() =>
			renderToString(
				<LegalLinks
					legalLinks={legalLinks}
					filter={(l) => l.registration}
					/* Without it the two links glue into
					   "DatenschutzerklärungImpressum" — the sanitizer
					   drops `class`, so a CSS separator cannot survive.
					   Same delimiter the registration's consent sentence
					   passes. */
					delimiter={', '}
				/>
			),
		[legalLinks]
	);

	/* The platform's consent sentence, exactly as the old gate built it. It is
	   the right text only when the department has no wording of its own; a
	   department that does have one governs the advice seeker instead. */
	const platformConsentHtml = useMemo(
		() =>
			t('anonymousConsent.label.text', {
				interpolation: { escapeValue: false },
				legal_links: legalLinksHtml
			}),
		[legalLinksHtml, t]
	);

	/* Product-owned fallback for an agency without a usable published policy.
	   It is intentionally a warning rather than a gate: the customer sees the
	   missing-policy risk, the configured legal links and the cookie disclosure,
	   and decides whether to continue with the existing checkbox. */
	const missingPolicyHtml = useMemo(
		() =>
			t('anonymousConsent.label.missingPolicy', {
				interpolation: { escapeValue: false },
				legal_links: legalLinksHtml
			}),
		[legalLinksHtml, t]
	);

	/**
	 * The department's own consent sentence, resolved from (agencyId, topicId).
	 *
	 * `idle` while the coordinate is unknown — the enquiry carries no agency,
	 * or the backend predates ORISO-UserService#1141 and does not send one.
	 * An absent or unavailable policy uses the fixed risk warning. An unavailable
	 * response keeps retrying in the background, but never blocks the customer.
	 */
	const [departmentConsent, setDepartmentConsent] =
		useState<DepartmentConsentState>({ status: 'idle' });

	const consent = useMemo(
		() =>
			resolveEntryRoomConsent({
				hasDepartment: department !== null,
				department: departmentConsent,
				platformHtml: platformConsentHtml,
				missingPolicyHtml,
				legalLinksHtml,
				locale
			}),
		[
			department,
			departmentConsent,
			legalLinksHtml,
			locale,
			missingPolicyHtml,
			platformConsentHtml
		]
	);

	const storageKey = (name: string) => `anonymous-${name}-${sessionId}`;
	const mark = (name: string, value = '1') => {
		try {
			sessionStorage.setItem(storageKey(name), value);
		} catch {
			/* ignore */
		}
	};

	/* A → B: the name goes to the session and the account; the old pseudonym
	   card did exactly this (SessionItemComponent handleConfirmPseudonym). */
	const handleContinue = useCallback(async () => {
		if (busy) return;
		const chosen = names[selectedIndex];
		if (!chosen) return;
		setBusy(true);
		setContinueFailed(false);
		try {
			/* One name, everywhere: the counsellor's queue shows the same
			   string the guest just picked. */
			await apiPutSessionData(sessionId, {
				displayName: chosen.userId
			});
			await apiPatchUserData({ displayName: chosen.userId });
			mark('pseudonym');
			mark('pseudonym-name', chosen.userId);
			if (!cancelled.current) setStage('waiting');
		} catch (error) {
			/* Without this the door swallowed the failure: the stage stayed on
			   `access` and nothing said why. */
			console.error('live chat entry: could not store the name', error);
			if (!cancelled.current) setContinueFailed(true);
		} finally {
			if (!cancelled.current) setBusy(false);
		}
	}, [busy, names, selectedIndex, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

	/* B: the queue, every 4 s — same endpoint and cadence the session used. */
	useEffect(() => {
		if (stage !== 'waiting' || accepted) return undefined;
		let stop = false;
		const refresh = () =>
			apiGetAnonymousEnquiryDetails(sessionId)
				.then((d) => {
					if (stop) return;
					if (typeof d?.peopleAhead === 'number')
						setAhead(d.peopleAhead);
					setAvailable(
						typeof d?.numAvailableConsultants === 'number'
							? d.numAvailableConsultants
							: null
					);
					/* The department coordinate is bound at registration, so it
					   arrives on the very first poll — the sentence is fetched
					   while the person waits and is ready long before anyone
					   accepts. Set once; the enquiry does not move department. */
					const agencyId = d?.agencyId;
					const topicId = d?.mainTopicId;
					if (
						typeof agencyId === 'number' &&
						typeof topicId === 'number'
					) {
						setDepartment((prev) => prev ?? { agencyId, topicId });
					}
					if (d?.status === 'IN_PROGRESS') setAccepted(true);
				})
				.catch(() => undefined);
		refresh();
		const timer = window.setInterval(refresh, POLL_MS);
		return () => {
			stop = true;
			window.clearInterval(timer);
		};
	}, [stage, accepted, sessionId]);

	/* Fetch as soon as the coordinate is known. A transient failure shows the
	   non-blocking warning immediately and keeps retrying, so published wording
	   can replace it if the service recovers while the customer is waiting. */
	useEffect(() => {
		if (!department || departmentConsent.status === 'ok') return undefined;
		let stop = false;
		const load = () =>
			apiGetConsentText(department.agencyId, department.topicId)
				.then((result) => {
					if (stop) return;
					setDepartmentConsent(
						result.status === 'ok'
							? {
									status: 'ok',
									sentence:
										result.consentText?.sentence ?? null,
									versionId:
										result.consentText?.versionId ?? null
								}
							: { status: 'unavailable' }
					);
				})
				.catch(() => {
					if (!stop) setDepartmentConsent({ status: 'unavailable' });
				});
		load();
		const timer = window.setInterval(load, POLL_MS);
		return () => {
			stop = true;
			window.clearInterval(timer);
		};
	}, [department, departmentConsent.status]);

	/* Closed steps back the moment someone is available again. */
	useEffect(() => {
		if (available && available > 0) setClosedDismissed(false);
	}, [available]);

	/* B′ → chat: consent on the account, the three marks for the session
	   component, then the hand-over — a full load, as the redeem did before,
	   so the app boots with the tokens the redeem set. */
	const handleAccept = useCallback(async () => {
		if (busy) return;
		setBusy(true);
		try {
			await apiPatchUserData({
				dataPrivacyConfirmation: true,
				termsAndConditionsConfirmation: true
			});
			/* Pin the agreement to the exact wording that was on screen
			   (ADR-022 decision 2). The account-level flag above records only
			   *that* somebody agreed; without this pointer a Träger publishing
			   new wording would not invalidate the acceptance, which is what
			   ADR-021 gave the legal texts a version history for. Only the
			   department levels carry a version — Träger and platform wording
			   lives in TenantService and has none, so there is nothing to pin
			   and the account flag stands alone, exactly as before.

			   Best-effort on purpose: the consent is already recorded on the
			   account, so a failure here must not strand somebody in the entry
			   room over a pointer the server treats as a refinement. */
			if (typeof consent.versionId === 'number') {
				try {
					await apiPutSessionConsent(sessionId, consent.versionId);
				} catch {
					/* keep going — the account-level confirmation carries it */
				}
			}
			mark('inquiry-consent');
			mark('waiting-dismissed');
			window.location.href = buildInviteSessionAppUrl(sessionId);
		} catch {
			if (!cancelled.current) setBusy(false);
		}
	}, [busy, sessionId, consent]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleLeave = useCallback(async () => {
		setBusy(true);
		setLeaveFailed(false);
		await performLeaveQueueDelete(sessionId, {
			onFailure: () => {
				if (!cancelled.current) {
					setLeaveFailed(true);
					setBusy(false);
				}
			}
		});
	}, [sessionId]);

	const goToMail = useCallback(() => navigate('/registration'), [navigate]);

	const closed =
		stage === 'waiting' && !accepted && available === 0 && !closedDismissed;
	const statusLine = closed
		? tr('status.closed', 'Gerade geschlossen')
		: stage === 'access'
			? tr('status.access', 'Ihr Zugang für dieses Gespräch')
			: accepted
				? tr(
						'status.accepted',
						'Eine Beraterin hat Ihr Gespräch angenommen'
					)
				: tr(
						'status.waiting',
						'Warteraum — freie Beraterin wird gesucht'
					);

	return (
		<EntryRoomShell kicker={kicker} statusLine={statusLine}>
			{stage === 'access' && (
				<LiveChatAccess
					names={names}
					selectedIndex={selectedIndex}
					busy={busy}
					failed={continueFailed}
					onSelect={setSelectedIndex}
					onReroll={() => {
						/* A new set, and the first of it taken: the way on
						   must never need a second click. */
						setNames(rollGuestNames(locale));
						setSelectedIndex(0);
					}}
					onContinue={() => {
						void handleContinue();
					}}
				/>
			)}
			{stage === 'waiting' && closed && (
				<LiveChatClosed
					onMailCounselling={goToMail}
					onLater={() => setClosedDismissed(true)}
				/>
			)}
			{stage === 'waiting' && !closed && (
				<LiveChatWaitingRoom
					ahead={ahead}
					/* Held only while the department lookup is still in flight —
					   a poll that reports the coordinate and IN_PROGRESS together
					   would otherwise show "no policy" for a centre that has one,
					   and let the hand-off record a consent pinning no version.
					   A *failed* lookup never holds; `resolveEntryRoomConsent`
					   owns that distinction. */
					accepted={consent.readable && accepted}
					consentHtml={consent.html}
					busy={busy}
					leaveFailed={leaveFailed}
					onAccept={() => {
						void handleAccept();
					}}
					onLeave={handleLeave}
					onMailCounselling={goToMail}
				/>
			)}
		</EntryRoomShell>
	);
};
