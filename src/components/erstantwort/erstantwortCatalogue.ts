import { ErstantwortActionKind } from './erstantwortPayload';

/**
 * ADR-018: the platform-owned Baustein catalogue.
 *
 * "The platform owns the ordering, the Träger owns the content" (§5). This file
 * is the ordering half: the fixed catalogue of ~15 units, each with a trigger,
 * a source, a modality assignment, an optional action, and whether a Träger may
 * switch it off. None of that is configurable — a Träger fills and toggles
 * *within* the catalogue, and can never reorder it, because the ordering
 * carries legal weight (consent must precede data transmission).
 *
 * The `default*` strings are the **platform fallback wording**. They serve
 * two purposes and only two:
 *
 * 1. so Storybook and the tests can render the full sequence with no backend
 *    (ORISO-Frontend#826);
 * 2. so gender-voice and catalogue-shape tests can pin the platform voice
 *    without going through i18n.
 *
 * Production resolve calls `t(key)` only. A missing key must follow the
 * locale fallback chain (#1154), not snap to these German strings.
 *
 * They are **not** the wording of a delivered Erstantwort. That is frozen into
 * the persisted event by the UserService (ADR-018 §4, ORISO-UserService#926),
 * so what was said to a person stays provable and a later configuration change
 * does not rewrite history. When an event is present its bodies always win.
 *
 * Every string here is written **gender-neutral by reformulation** (§7): no
 * `Berater*in`, no `Berater_innen`, no `Berater:innen`, and no gendered noun at
 * all — "eine passende Ansprechperson", "Sie erhalten eine Antwort". A notation
 * axis was deliberately rejected; `erstantwortCatalogue.test.ts` pins this.
 */

/** When a Baustein is said. Platform-assigned, never Träger-configurable. */
export const ERSTANTWORT_TRIGGERS = [
	'CHAT_ENTRY',
	'AFTER_FIRST_MESSAGE',
	'AFTER_ENQUIRY_DISPATCHED',
	'AFTER_ASSIGNMENT'
] as const;

export type ErstantwortTrigger = (typeof ERSTANTWORT_TRIGGERS)[number];

/** Where the words come from. A DERIVED Baustein is never a text field. */
export type ErstantwortSource = 'PLATFORM' | 'AGENCY' | 'DERIVED';

export type ErstantwortModality =
	| 'AGENCY_COUNSELLING'
	| 'LIVE_CHAT'
	| 'SELF_HELP';

const ALL_MODALITIES: ErstantwortModality[] = [
	'AGENCY_COUNSELLING',
	'LIVE_CHAT',
	'SELF_HELP'
];

/** Asynchronous modalities — the ones that have an enquiry and a deadline. */
const ASYNC_MODALITIES: ErstantwortModality[] = [
	'AGENCY_COUNSELLING',
	'SELF_HELP'
];

/**
 * ADR-018 §6: the deliberate interim substitute for the postponed two-level
 * platform/Träger permission model. Until that model exists, the two
 * safety-bearing Bausteine simply cannot be switched off by anybody.
 */
export const UNTOGGLEABLE_BAUSTEIN_IDS = [
	'noPersonalData',
	'emergencyNumbers'
] as const;

export interface ErstantwortCatalogueEntry {
	id: string;
	trigger: ErstantwortTrigger;
	source: ErstantwortSource;
	modalities: ErstantwortModality[];
	/** May a Träger switch this Baustein off? */
	toggleable: boolean;
	/** May a Träger author its text? Always false for DERIVED. */
	editable: boolean;
	/** The single per-Träger escape hatch (ADR-018 §2). Exactly one exists. */
	isFree?: boolean;
	headlineKey?: string;
	defaultHeadline?: string;
	bodyKey: string;
	defaultBody: string;
	action?: {
		kind: ErstantwortActionKind;
		labelKey: string;
		defaultLabel: string;
	};
}

/**
 * Catalogue order **is** render order. Note two orderings that are not
 * cosmetic: the safety Bausteine ("send us no personal data", the emergency
 * numbers) come before every optional action, and the free notice sits at a
 * fixed position just before the closing so a Träger cannot push it to the top.
 */
export const ERSTANTWORT_CATALOGUE: ErstantwortCatalogueEntry[] = [
	{
		id: 'greeting',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'AGENCY',
		modalities: ALL_MODALITIES,
		toggleable: false,
		editable: true,
		bodyKey: 'erstantwort.greeting.body',
		defaultBody:
			'Schön, dass Sie sich gemeldet haben. Ihre Nachricht ist bei uns angekommen.'
	},
	{
		id: 'whoReadsAlong',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'AGENCY',
		// Live Chat has neither teams nor case handover, so there is nothing
		// to disclose about who else reads along.
		modalities: ASYNC_MODALITIES,
		toggleable: false,
		editable: true,
		headlineKey: 'erstantwort.whoReadsAlong.headline',
		defaultHeadline: 'Wer Ihre Nachricht liest',
		bodyKey: 'erstantwort.whoReadsAlong.body',
		defaultBody:
			'Ihre Nachricht lesen ausschließlich die Fachkräfte der zuständigen Beratungsstelle. Alle sind zur Verschwiegenheit verpflichtet.'
	},
	{
		id: 'responseDeadline',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'DERIVED',
		// Live Chat is synchronous — a reply deadline would be a nonsense promise.
		modalities: ASYNC_MODALITIES,
		toggleable: false,
		editable: false,
		headlineKey: 'erstantwort.responseDeadline.headline',
		defaultHeadline: 'Wann Sie eine Antwort erhalten',
		bodyKey: 'erstantwort.responseDeadline.body',
		defaultBody:
			'Sie erhalten innerhalb von {{deadlineDays}} Werktagen eine Antwort von einer passenden Ansprechperson.'
	},
	{
		id: 'modalityNote',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'DERIVED',
		modalities: ALL_MODALITIES,
		toggleable: true,
		editable: false,
		bodyKey: 'erstantwort.modalityNote.body',
		defaultBody:
			'Die Beratung findet schriftlich in diesem geschützten Bereich statt. Sie können jederzeit weiterschreiben.'
	},
	{
		id: 'noPersonalData',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'PLATFORM',
		modalities: ALL_MODALITIES,
		toggleable: false,
		editable: false,
		headlineKey: 'erstantwort.noPersonalData.headline',
		defaultHeadline: 'Bitte keine persönlichen Daten senden',
		bodyKey: 'erstantwort.noPersonalData.body',
		defaultBody:
			'Bitte schreiben Sie uns keinen vollständigen Namen, keine Adresse und keine Telefonnummer. Für die Beratung brauchen wir das nicht.'
	},
	{
		id: 'emergencyNumbers',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'PLATFORM',
		modalities: ALL_MODALITIES,
		toggleable: false,
		editable: false,
		headlineKey: 'erstantwort.emergencyNumbers.headline',
		defaultHeadline: 'Wenn es nicht warten kann',
		bodyKey: 'erstantwort.emergencyNumbers.body',
		defaultBody:
			'Bei einer akuten Notlage erreichen Sie rund um die Uhr die Telefonseelsorge unter 0800 111 0 111 oder 0800 111 0 222 und den Rettungsdienst unter 112.'
	},
	{
		id: 'dataProtection',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'DERIVED',
		modalities: ALL_MODALITIES,
		toggleable: true,
		editable: false,
		bodyKey: 'erstantwort.dataProtection.body',
		defaultBody:
			'Wie wir mit Ihren Daten umgehen, steht in der Datenschutzerklärung.'
	},
	{
		id: 'freeNotice',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'AGENCY',
		modalities: ALL_MODALITIES,
		toggleable: true,
		editable: true,
		isFree: true,
		bodyKey: 'erstantwort.freeNotice.body',
		// Intentionally empty by default: the escape hatch says nothing until a
		// Träger fills it, and an unfilled Baustein is dropped at render time.
		defaultBody: ''
	},
	{
		id: 'emailNotification',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'PLATFORM',
		modalities: ALL_MODALITIES,
		toggleable: true,
		editable: false,
		headlineKey: 'erstantwort.emailNotification.headline',
		defaultHeadline: 'Benachrichtigung per E-Mail',
		bodyKey: 'erstantwort.emailNotification.body',
		defaultBody:
			'Sie können freiwillig eine E-Mail-Adresse hinterlegen. Dann erhalten Sie eine Nachricht, sobald eine Antwort da ist. Der Inhalt der Beratung steht nie in dieser E-Mail.',
		action: {
			kind: 'ADD_EMAIL',
			labelKey: 'erstantwort.emailNotification.action',
			defaultLabel: 'E-Mail-Adresse angeben'
		}
	},
	{
		id: 'accountProtection',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'PLATFORM',
		modalities: ALL_MODALITIES,
		toggleable: true,
		editable: false,
		headlineKey: 'erstantwort.accountProtection.headline',
		defaultHeadline: 'Ihr Zugang, zusätzlich geschützt',
		bodyKey: 'erstantwort.accountProtection.body',
		defaultBody:
			'Sie können Ihren Zugang mit einem zweiten Faktor sichern, damit niemand sonst hineinkommt.',
		action: {
			kind: 'ENABLE_2FA',
			labelKey: 'erstantwort.accountProtection.action',
			defaultLabel: 'Zugang schützen'
		}
	},
	{
		id: 'closing',
		trigger: 'AFTER_FIRST_MESSAGE',
		source: 'AGENCY',
		modalities: ALL_MODALITIES,
		toggleable: true,
		editable: true,
		bodyKey: 'erstantwort.closing.body',
		defaultBody: 'Bis bald — wir melden uns bei Ihnen.'
	},

	/* --- after the enquiry was dispatched (ORISO-Frontend#825) ------------
	   No Live Chat: there is no enquiry to dispatch, and someone who just
	   chose their name in the pseudonym card must not be asked again three
	   minutes later. */
	{
		id: 'enquiryReceived',
		trigger: 'AFTER_ENQUIRY_DISPATCHED',
		source: 'PLATFORM',
		modalities: ASYNC_MODALITIES,
		toggleable: false,
		editable: true,
		headlineKey: 'erstantwort.enquiryReceived.headline',
		defaultHeadline: 'Ihre Nachricht ist bei uns',
		bodyKey: 'erstantwort.enquiryReceived.body',
		defaultBody:
			'Wir suchen jetzt eine Ansprechperson, die zu Ihrem Anliegen passt. Innerhalb von {{deadlineDays}} Werktagen erhalten Sie eine Antwort.'
		/* The illustration rides in the `enquiryReceived` slot rather than in
		   the body: a Träger may rewrite these words, and a picture that stops
		   matching rewritten text is worse than no picture. */
	},
	{
		id: 'notificationChoice',
		trigger: 'AFTER_ENQUIRY_DISPATCHED',
		source: 'PLATFORM',
		modalities: ASYNC_MODALITIES,
		toggleable: true,
		editable: false,
		headlineKey: 'erstantwort.notificationChoice.headline',
		defaultHeadline: 'Wie sollen wir Sie erreichen?',
		bodyKey: 'erstantwort.notificationChoice.body',
		defaultBody:
			'Sie müssen nicht warten und immer wieder nachsehen. Sagen Sie uns, wie wir Ihnen Bescheid geben dürfen, sobald die Antwort da ist.'
		/* No `action`: three choices do not fit one button. The affordance is
		   the inline NotificationChoiceCard, in the `notificationChoice` slot. */
	},
	{
		id: 'deviceLimit',
		trigger: 'AFTER_ENQUIRY_DISPATCHED',
		source: 'PLATFORM',
		modalities: ASYNC_MODALITIES,
		toggleable: false,
		editable: false,
		headlineKey: 'erstantwort.deviceLimit.headline',
		defaultHeadline: 'Eines noch, damit nichts verloren geht',
		bodyKey: 'erstantwort.deviceLimit.body',
		/* The reassurance comes first and the limit second, because the limit
		   alone reads as "you are about to lose everything". You are not locked
		   out of the counselling — the counsellor keeps the conversation and can
		   pick it up. Only your own copy of what you already wrote depends on
		   this device. */
		defaultBody:
			'Was Sie hier schreiben, kann nur auf diesem Gerät gelesen werden — das schützt Sie. Wechseln Sie später das Gerät, geht die Beratung ganz normal weiter; Ihre Ansprechperson hat das Gespräch und knüpft daran an. Nur Ihre eigene Sicht auf das bisher Geschriebene braucht dann Ihren Ersatzschlüssel.',
		action: {
			kind: 'SHOW_RECOVERY_KEY',
			labelKey: 'erstantwort.deviceLimit.action',
			defaultLabel: 'Ersatzschlüssel ansehen'
		}
	},
	{
		id: 'saveCredentials',
		trigger: 'AFTER_ENQUIRY_DISPATCHED',
		source: 'PLATFORM',
		modalities: ASYNC_MODALITIES,
		toggleable: true,
		editable: false,
		headlineKey: 'erstantwort.saveCredentials.headline',
		defaultHeadline: 'Sichern Sie sich Ihren Zugang',
		bodyKey: 'erstantwort.saveCredentials.body',
		defaultBody:
			'Ohne Ihren Anmeldenamen kommen Sie später nicht mehr in dieses Gespräch zurück. Bewahren Sie ihn gut auf — am besten in einem Passwort-Manager.'
		/* No `action` on purpose. This Baustein's affordance is the inline
		   SaveCredentialsCard — the login name has to be *in front of* the
		   person, not behind a button they must press first. A button here would
		   either open nothing or duplicate the card, and a button that does
		   nothing is worse than no button. */
	},
	{
		id: 'displayName',
		trigger: 'AFTER_ENQUIRY_DISPATCHED',
		source: 'PLATFORM',
		modalities: ASYNC_MODALITIES,
		toggleable: true,
		editable: false,
		headlineKey: 'erstantwort.displayName.headline',
		defaultHeadline: 'Ihr angezeigter Name',
		bodyKey: 'erstantwort.displayName.body',
		defaultBody:
			'Im Gespräch erscheinen Sie unter einem zufällig erzeugten Namen. Sie können ihn jederzeit neu würfeln.',
		action: {
			kind: 'SET_DISPLAY_NAME',
			labelKey: 'erstantwort.displayName.action',
			defaultLabel: 'Namen ändern'
		}
	}
];

export const bausteinById = (
	id: string
): ErstantwortCatalogueEntry | undefined =>
	ERSTANTWORT_CATALOGUE.find((entry) => entry.id === id);

export interface ErstantwortModalityContext {
	conversationType?: string | null;
}

/**
 * Maps a session's `conversationType` onto a modality. Anything unknown —
 * including `INTERNAL_GROUP`, which is a counsellor-side room and never sees an
 * Erstantwort — resolves to Agency Counselling, the default asker-facing shape.
 */
const toModality = (conversationType?: string | null): ErstantwortModality => {
	if (conversationType === 'LIVE_CHAT') return 'LIVE_CHAT';
	if (conversationType === 'SELF_HELP') return 'SELF_HELP';
	return 'AGENCY_COUNSELLING';
};

/** The Bausteine of one trigger that apply to this session's modality, in order. */
export const catalogueForTrigger = (
	trigger: ErstantwortTrigger,
	context: ErstantwortModalityContext = {}
): ErstantwortCatalogueEntry[] => {
	const modality = toModality(context.conversationType);
	return ERSTANTWORT_CATALOGUE.filter(
		(entry) =>
			entry.trigger === trigger && entry.modalities.includes(modality)
	);
};
