import { practiceUserId } from './practiceIdentifiers';

export interface PracticePerson {
	/** Practice consultant/user id; never a real Keycloak id. */
	id: string;
	username: string;
	displayName: string;
	firstName: string;
	lastName: string;
	matrixUserId: string;
}

/** Fictional cast (spec 3.6). The counsellor is the real logged-in user. */
export const PRACTICE_CAST = {
	asker: {
		id: 'practice-asker',
		username: 'sam-muster-uebung',
		displayName: 'Sam Muster (Übung)',
		firstName: 'Sam',
		lastName: 'Muster (Übung)',
		matrixUserId: practiceUserId('asker')
	},
	colleague: {
		id: 'practice-colleague',
		username: 'alex-uebung',
		displayName: 'Alex (Übung)',
		firstName: 'Alex',
		lastName: '(Übung)',
		matrixUserId: practiceUserId('colleague')
	},
	supervisor: {
		id: 'practice-supervisor',
		username: 'robin-uebung',
		displayName: 'Robin (Übung)',
		firstName: 'Robin',
		lastName: '(Übung)',
		matrixUserId: practiceUserId('supervisor')
	}
} as const satisfies Record<string, PracticePerson>;

export const PRACTICE_COUNSELLOR_MATRIX_USER_ID = practiceUserId('counsellor');

/** Draft script, German source (spec 3.6). S8 moves these into i18n. */
export const PRACTICE_SCRIPT = {
	enquiry:
		'Guten Tag, ich habe eine allgemeine Frage zu Ihrem Angebot. Wie läuft eine Beratung bei Ihnen ab, und wie schnell bekomme ich eine Antwort? Vielen Dank.',
	askerReply:
		'Vielen Dank für Ihre Antwort. Das hilft mir weiter. Ich melde mich, wenn ich noch Fragen habe.',
	teamColleague:
		'Ich bin heute im Termin und schaffe die Antwort nicht mehr. Kannst du die Anfrage übernehmen?',
	supervisorReply:
		'Das klingt gut so. Frag ruhig nach, was die Person genau wissen möchte. Ich lese mit und melde mich, wenn mir etwas auffällt.',
	erstantwortGreeting:
		'Ihre Anfrage ist bei uns eingegangen. Eine Beraterin oder ein Berater meldet sich bei Ihnen.',
	acceptedCaseCounsellor:
		'Guten Tag, danke für Ihre Nachricht. Eine Beratung läuft hier schriftlich und vertraulich ab.',
	agencyName: 'Übungsstelle'
} as const;
