import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Encryption settings, the login recovery prompt, the chat E2EE banner, and
 * notification preview labels used to pass German or English i18next
 * fallbacks. Missing keys then snapped to one language (#1154).
 */
const SLICE_FILES = [
	'src/components/session/EncryptionBanner.tsx',
	'src/components/profile/EncryptionSettings/index.tsx',
	'src/components/E2EEncryptionSupportBanner/KeyBackupRecoveryPrompt.tsx',
	'src/components/notificationsCenter/ActivityTimelineEmptyState.tsx',
	'src/components/notificationsCenter/NotificationsCenter.tsx'
];

const ONE_LANGUAGE_FALLBACKS = [
	/'End-to-end encryption is enabled'/,
	/'Messages in this room are end-to-end encrypted/,
	/'Ersatzschlüssel einrichten'/,
	/'Verschlüsselung & Wiederherstellung'/,
	/'Wird geladen …'/,
	/'Die Verschlüsselungseinstellungen sind gerade nicht verfügbar/,
	/'Richten Sie einmalig einen Ersatzschlüssel ein/,
	/'Ihr Tresor wird gerade schon eingerichtet/,
	/'Die Einrichtung ist fehlgeschlagen/,
	/'Dieser Ersatzschlüssel ist ungültig/,
	/'Die Wiederherstellung ist fehlgeschlagen/,
	/'Das Zurücksetzen ist fehlgeschlagen/,
	/'Ich habe den Schlüssel sicher gespeichert/,
	/'Schlüssel kopieren'/,
	/'Verlauf wiederherstellen'/,
	/'Verschlüsselung zurücksetzen'/,
	/'Ja, zurücksetzen'/,
	/'Schön, dass Sie wieder da sind'/,
	/'Sie sind auf einem neuen Gerät angemeldet/,
	/'Geben Sie Ihren Ersatzschlüssel ein/,
	/'Tresor öffnen'/,
	/'Wird wiederhergestellt …'/,
	/'No notifications yet\.'/,
	/'Audio message'/,
	/'Unsupported message'/,
	/'Waiting for decryption'/,
	/'Conversation unavailable on this device'/,
	/'Message unavailable in local history'/
];

describe('encryption and notifications have no one-language t() fallbacks (#1154)', () => {
	it.each(SLICE_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
		const hits = ONE_LANGUAGE_FALLBACKS.filter((pattern) =>
			pattern.test(src)
		);
		expect(hits.map(String)).toEqual([]);
	});
});
