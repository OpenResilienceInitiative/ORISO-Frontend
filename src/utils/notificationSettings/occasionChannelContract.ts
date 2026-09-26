import {
	EMAIL_AUDIENCE,
	type EmailId
} from '../../emails/content/emailCatalogue';
import {
	ADVICE_SEEKER_SWITCHES,
	CONSULTANT_SWITCHES,
	switchForOccasion,
	type NotificationSource
} from '../../components/profile/EmailNotifications/notificationMatrix';

type RecipientRole = 'asker' | 'consultant' | 'admin';
type BrowserAssociation =
	| { kind: 'descriptor'; eventTypes: readonly string[] }
	| { kind: 'unmapped' };
type EmailPreference =
	| { kind: 'switch'; source: NotificationSource }
	| { kind: 'no-switch' };

/**
 * A seeded browser descriptor is a UI route, not proof that a producer emits it.
 * Keep an explicit entry for every mail so adding one requires a channel review.
 */
const BROWSER_ASSOCIATIONS: Record<EmailId, BrowserAssociation> = {
	'neue-nachricht': { kind: 'descriptor', eventTypes: ['message.new'] },
	'willkommen': { kind: 'unmapped' },
	'passwort-zuruecksetzen': { kind: 'unmapped' },
	'termin': { kind: 'unmapped' },
	'beraterin-kontakt': { kind: 'unmapped' },
	'anfrage-zugewiesen': { kind: 'unmapped' },
	'systemhinweis': { kind: 'unmapped' },
	'neue-anfrage': { kind: 'descriptor', eventTypes: ['request.new'] },
	'direkte-anfrage': { kind: 'unmapped' },
	'tagesuebersicht': { kind: 'unmapped' },
	'uebergabe-angefragt': {
		kind: 'descriptor',
		eventTypes: ['handover.requested']
	},
	'uebergabe-bestaetigt': {
		kind: 'descriptor',
		eventTypes: ['handover.all_confirmed']
	},
	'rueckmeldung': { kind: 'unmapped' },
	'mitteilung': { kind: 'unmapped' },
	'anmeldelink': { kind: 'unmapped' },
	'einmalcode': { kind: 'unmapped' },
	'email-geaendert': { kind: 'unmapped' },
	'einladung-traeger': { kind: 'unmapped' },
	'einladung-fachkraft': { kind: 'unmapped' },
	'avv-unterschrift': { kind: 'unmapped' },
	'einladung-freitext': { kind: 'unmapped' },
	'team-aenderung': {
		kind: 'descriptor',
		eventTypes: [
			'supervisor.added',
			'supervisor.removed',
			'supervisor.assigned',
			'counselor.renamed'
		]
	},
	'smtp-test': { kind: 'unmapped' }
};

/**
 * The email catalogue names one primary audience. New-message mail is shared
 * by seekers and counsellors; each role has a different preference store.
 */
const rolesFor = (id: EmailId): readonly RecipientRole[] =>
	id === 'neue-nachricht' ? ['asker', 'consultant'] : [EMAIL_AUDIENCE[id]];

export function occasionChannelContract(id: EmailId): {
	roles: readonly RecipientRole[];
};
export function occasionChannelContract(
	id: EmailId,
	role: RecipientRole
):
	| { emailPreference: EmailPreference; browser: BrowserAssociation }
	| undefined;
export function occasionChannelContract(id: EmailId, role?: RecipientRole) {
	const roles = rolesFor(id);
	if (role === undefined) {
		return { roles };
	}
	if (!roles.includes(role)) {
		return undefined;
	}
	const switches =
		role === 'asker'
			? ADVICE_SEEKER_SWITCHES
			: role === 'consultant'
				? CONSULTANT_SWITCHES
				: [];
	const source = switchForOccasion(switches, id)?.source;
	return {
		emailPreference: source
			? { kind: 'switch' as const, source }
			: { kind: 'no-switch' as const },
		browser: BROWSER_ASSOCIATIONS[id]
	};
}
