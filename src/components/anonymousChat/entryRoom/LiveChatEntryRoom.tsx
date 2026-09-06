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
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { apiPutSessionData } from '../../../api/apiPutSessionData';
import { performLeaveQueueDelete } from '../../pseudonym/leaveQueueDelete';
import {
	generatePseudonym,
	regeneratePseudonym
} from '../../../utils/pseudonymGenerator';
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
	const [pseudonym, setPseudonym] = useState<Pseudonym>(() =>
		generatePseudonym(locale)
	);
	const [busy, setBusy] = useState(false);
	const [ahead, setAhead] = useState<number | null>(null);
	const [available, setAvailable] = useState<number | null>(null);
	const [accepted, setAccepted] = useState(false);
	const [closedDismissed, setClosedDismissed] = useState(false);
	const [leaveFailed, setLeaveFailed] = useState(false);
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

	/* The tenant's consent sentence, exactly as the old gate built it. */
	const consentHtml = useMemo(
		() =>
			t('anonymousConsent.label.text', {
				interpolation: { escapeValue: false },
				legal_links: renderToString(
					<LegalLinks
						legalLinks={legalLinks}
						filter={(l) => l.registration}
					/>
				)
			}),
		[legalLinks, t]
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
		setBusy(true);
		try {
			await apiPutSessionData(sessionId, {
				displayName: pseudonym.displayName
			});
			await apiPatchUserData({ displayName: pseudonym.displayName });
			mark('pseudonym');
			mark('pseudonym-name', pseudonym.displayName);
			if (!cancelled.current) setStage('waiting');
		} finally {
			if (!cancelled.current) setBusy(false);
		}
	}, [busy, pseudonym, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

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
			mark('inquiry-consent');
			mark('waiting-dismissed');
			window.location.href = buildInviteSessionAppUrl(sessionId);
		} catch {
			if (!cancelled.current) setBusy(false);
		}
	}, [busy, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

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
					pseudonym={pseudonym}
					busy={busy}
					onReroll={() =>
						setPseudonym((p) => regeneratePseudonym(p, locale))
					}
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
					accepted={accepted}
					consentHtml={consentHtml}
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
