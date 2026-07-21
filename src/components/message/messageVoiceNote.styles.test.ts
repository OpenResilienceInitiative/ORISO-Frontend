import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const messageStyles = () =>
	fs.readFileSync(
		path.join(process.cwd(), 'src/components/message/message.styles.scss'),
		'utf8'
	);

describe('voice-note M3 color roles', () => {
	it('uses the primary token family instead of hard-coded success green', () => {
		const scss = messageStyles();
		const voiceNoteStyles = scss.slice(
			scss.indexOf('&__voiceNote'),
			scss.indexOf('&__action', scss.indexOf('&__voiceNote'))
		);

		expect(voiceNoteStyles).toContain(
			'background: var(--m3-primary-container, #cc1e1c);'
		);
		expect(voiceNoteStyles).toContain(
			'color: var(--m3-on-primary-container, #ffe2de);'
		);
		expect(voiceNoteStyles).toContain(
			'background: var(--m3-primary, #a5000a);'
		);
		expect(voiceNoteStyles).toContain(
			'color: var(--m3-on-primary, #ffffff);'
		);
		expect(voiceNoteStyles).not.toContain('#32b86c');
		expect(voiceNoteStyles).not.toContain('rgba(0, 0, 0, 0.18)');
	});
});
