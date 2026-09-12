import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Account-invite, drafts center, session-list chips, case-handover
 * consent chrome, and shortcut key labels used to pass German or English
 * i18next fallbacks. Missing keys then snapped to one language (#1154).
 */
const SLICE_FILES = [
	'src/components/accountInvite/AccountInviteAcceptance.tsx',
	'src/components/draftsCenter/DraftsCenter.tsx',
	'src/components/sessionsList/EnquiryFilterChips.tsx',
	'src/components/sessionsList/SessionsList.tsx',
	'src/components/sessionsList/SessionsListToolbar.tsx',
	'src/components/caseHandover/CaseHandoverClientCards.tsx',
	'src/features/keyboard-shortcuts/components/KeyboardShortcutsSettings.tsx'
];

const ONE_LANGUAGE_FALLBACKS = [
	/'Der Einladungslink ist ungültig/,
	/'Zur Anmeldung'/,
	/'Konto erstellt'/,
	/'Beratungskonto erstellen'/,
	/'E-Mail-Adresse'/,
	/'Benutzername'/,
	/'Passwort wiederholen'/,
	/'Konto erstellen'/,
	/'Drafts'/,
	/'No drafts yet\.'/,
	/'Open draft'/,
	/'Next draft'/,
	/'Delete draft'/,
	/'Select a draft to continue writing\.'/,
	/'Unsent messages are saved/,
	/'Unsent message saved'/,
	/'Mail'/,
	/'Live Chat'/,
	/'Unread'/,
	/'Internal group chat'/,
	/'Conversation circle'/,
	/'Close search'/,
	/'Confirm selection'/,
	/'Clear search'/,
	/'Carimat'/,
	/'Quick Guide'/,
	/'Privacy notice for case handover'/,
	/'Approve access'/,
	/'Decline access'/,
	/'More options'/,
	/defaultValue:\s*'Ctrl'/,
	/defaultValue:\s*'Cmd'/,
	/defaultValue:\s*'Enter'/,
	/fallback:\s*'Mail'/,
	/translated !== key \? translated : fallback/
];

const REQUIRED_INVITE_KEYS = [
	'title',
	'successTitle',
	'email',
	'username',
	'password',
	'repeatPassword',
	'submit'
] as const;

describe('leftover chrome has no one-language t() fallbacks (#1154)', () => {
	it.each(SLICE_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
		const hits = ONE_LANGUAGE_FALLBACKS.filter((pattern) =>
			pattern.test(src)
		);
		expect(hits.map(String)).toEqual([]);
	});

	it('ships account-invite form keys and removeSelectedPerson in every UI locale', () => {
		const locales = ['de', 'en', 'fr', 'ru', 'ti', 'tr'];
		for (const locale of locales) {
			const catalogue = JSON.parse(
				readFileSync(
					resolve(
						process.cwd(),
						`src/resources/i18n/${locale}/common.json`
					),
					'utf8'
				)
			) as {
				accountInvite?: Record<string, string>;
				sessionList?: {
					toolbar?: { search?: { removeSelectedPerson?: string } };
				};
			};
			for (const key of REQUIRED_INVITE_KEYS) {
				expect(
					catalogue.accountInvite?.[key],
					`${locale} accountInvite.${key}`
				).toBeTruthy();
			}
			expect(
				catalogue.sessionList?.toolbar?.search?.removeSelectedPerson,
				`${locale} removeSelectedPerson`
			).toMatch(/\{\{\s*name\s*\}\}/);
		}
	});
});
