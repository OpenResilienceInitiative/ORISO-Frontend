import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * #1824 guard: the Activity Timeline preview must never tell the server
 * "this person is reading this room" — the active view that makes the
 * backend stop creating Timeline entries. The runtime half lives in
 * ConversationPreview.test.tsx (the API is mocked and must never be called
 * while reading or writing); this is the static half: no module of the
 * preview, nor the shared hooks it uses, imports the call at all.
 */
const ACTIVE_VIEW_API = 'apiPatchNotificationActiveView';

const sourcesIn = (dir: string) =>
	readdirSync(dir)
		.filter((name) => /\.(ts|tsx)$/.test(name))
		.filter((name) => !/\.(test|stories)\.tsx?$/.test(name))
		.map((name) => join(dir, name));

const PREVIEW_SOURCES = [
	...sourcesIn(__dirname),
	join(__dirname, '../session/useConversationActions.ts'),
	join(__dirname, '../session/useMatrixTyping.ts'),
	join(__dirname, '../session/MessageTimeline.tsx'),
	join(__dirname, '../message/MessageItemComponent.tsx'),
	join(
		__dirname,
		'../messageSubmitInterface/messageSubmitInterfaceComponent.tsx'
	),
	join(__dirname, '../../hooks/useSession.tsx')
];

describe('the Timeline preview never sends the active view (#1824)', () => {
	it.each(PREVIEW_SOURCES)('%s does not import it', (file) => {
		expect(readFileSync(file, 'utf8')).not.toContain(ACTIVE_VIEW_API);
	});

	it('covers the preview modules themselves', () => {
		const names = PREVIEW_SOURCES.map((file) => file.split('/').pop());
		expect(names).toEqual(
			expect.arrayContaining([
				'ConversationPreview.tsx',
				'useConversationPreview.ts',
				'NotificationsCenter.tsx'
			])
		);
	});
});
