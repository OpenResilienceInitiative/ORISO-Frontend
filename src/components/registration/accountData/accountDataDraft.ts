import type { Pseudonym } from '../../../utils/anonName/engine';

/**
 * In-memory draft of the account step so nothing typed is lost when the user
 * navigates back and forth in the registration stepper. The values (incl. the
 * password) deliberately never touch session/localStorage — the draft only has
 * to survive step navigation inside the running app.
 */
export interface AccountDataDraft {
	identity: Pseudonym;
	username: string;
	password: string;
	repeatPassword: string;
	dataProtectionChecked: boolean;
}

let draft: AccountDataDraft | null = null;

export const getAccountDataDraft = (): AccountDataDraft | null => draft;

export const setAccountDataDraft = (next: AccountDataDraft): void => {
	draft = next;
};

export const clearAccountDataDraft = (): void => {
	draft = null;
};
