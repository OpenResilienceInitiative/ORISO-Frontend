import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Composer toolbar, audience chips, failed-send cards, and thread chrome
 * used to pass English or German i18next fallbacks. Missing keys then
 * snapped to one language (#1154).
 */
const SLICE_FILES = [
	'src/components/messageSubmitInterface/inputField/ComposerToolbar.tsx',
	'src/components/messageSubmitInterface/inputField/DefaultActionBar.tsx',
	'src/components/messageSubmitInterface/messageSubmitInterfaceComponent.tsx',
	'src/components/message/MessageItemComponent.tsx',
	'src/components/message/MessageSendFailed.tsx',
	'src/components/session/SessionItemComponent.tsx'
];

const ONE_LANGUAGE_FALLBACKS = [
	/'Text style'/,
	/'Normal text'/,
	/'Large heading'/,
	/'Task List'/,
	/'Bullet List'/,
	/'Emoji panel'/,
	/'Voice recording'/,
	/'Send to all'/,
	/'Alle'/,
	/'Niemand gefunden'/,
	/'nicht im Chat'/,
	/'Stop'/,
	/'Antwort an'/,
	/'Threads'/,
	/'Reply in Thread'/,
	/'Mark Text'/,
	/'Forward Message'/,
	/'User left the chat'/,
	/'not delivered'/,
	/'nicht zugestellt'/,
	/'\(bearbeitet\)'/,
	/'Sending message failed'/,
	/'Try again'/,
	/'Minimize editor'/,
	/'Maximize editor'/,
	/'Text snippet added to your reply'/,
	/defaultValue:\s*`\$\{selectedAudienceLabels\.length\} Personen`/
];

describe('composer and message chrome have no one-language t() fallbacks (#1154)', () => {
	it.each(SLICE_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
		const hits = ONE_LANGUAGE_FALLBACKS.filter((pattern) =>
			pattern.test(src)
		);
		expect(hits.map(String)).toEqual([]);
	});
});
