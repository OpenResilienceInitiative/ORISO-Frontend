import { practiceUserId } from './practiceIdentifiers';

export type PracticePersonKey = 'asker' | 'colleague' | 'supervisor';

/** What never changes between runs and languages. */
export interface PracticePersonIdentity {
	/** Practice consultant/user id; never a real Keycloak id. */
	id: string;
	username: string;
	/** Invented, not translated. */
	firstName: string;
	matrixUserId: string;
}

/** The identity plus the names the counsellor reads, in the run's language. */
export interface PracticePerson extends PracticePersonIdentity {
	displayName: string;
	lastName: string;
}

/**
 * Fictional cast (spec 3.6). The counsellor is the real logged-in user. Display
 * names carry the localised "(Übung)" suffix and therefore come from the
 * ScriptEngine (`script.cast`), not from here.
 */
export const PRACTICE_CAST = {
	asker: {
		id: 'practice-asker',
		username: 'sam-muster-uebung',
		firstName: 'Sam',
		matrixUserId: practiceUserId('asker')
	},
	colleague: {
		id: 'practice-colleague',
		username: 'alex-uebung',
		firstName: 'Alex',
		matrixUserId: practiceUserId('colleague')
	},
	supervisor: {
		id: 'practice-supervisor',
		username: 'robin-uebung',
		firstName: 'Robin',
		matrixUserId: practiceUserId('supervisor')
	}
} as const satisfies Record<PracticePersonKey, PracticePersonIdentity>;

export const PRACTICE_COUNSELLOR_MATRIX_USER_ID = practiceUserId('counsellor');
