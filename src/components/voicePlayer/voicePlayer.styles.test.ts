import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Successor to messageVoiceNote.styles.test.ts: the voice note moved out of
 * message.styles.scss into its own component, and the colour guard moved with
 * it. Red stays the single signal colour — no success green, no second
 * colour system.
 *
 * The encryption-notice half of the original guard is not here: redesigning
 * that notice is its own change and does not belong in #996.
 */
const readStyles = (file: string) =>
	fs.readFileSync(
		path.join(process.cwd(), 'src/components/voicePlayer', file),
		'utf8'
	);

describe('voice player M3 colour roles', () => {
	const scss = readStyles('voicePlayer.styles.scss');

	it('uses the primary token family for the play control', () => {
		expect(scss).toContain('background: var(--m3-primary, #a5000a);');
		expect(scss).toContain('color: var(--m3-on-primary, #ffffff);');
		expect(scss).toContain('background: var(--m3-primary-hover, #820006);');
	});

	it('carries no success green and no second signal colour', () => {
		expect(scss).not.toContain('#32b86c');
		expect(scss).not.toContain('form-success');
		expect(scss).not.toMatch(/--m3-success/);
	});

	it('lets bubble="none" inherit the idle tile colour from its surroundings', () => {
		// Declaring the custom property on .voicePlayer itself would shadow
		// whatever the surrounding bubble sets, so the default has to live at
		// the use site as a var() fallback.
		expect(scss).not.toMatch(/^\t--voice-player-tile-idle:/m);
		expect(scss).toContain(
			'background: var(--voice-player-tile-idle, rgba(165, 0, 10, 0.22));'
		);
	});
});
