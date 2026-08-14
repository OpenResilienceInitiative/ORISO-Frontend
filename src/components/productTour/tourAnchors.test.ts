import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const componentsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Source-level contract for the shared product-tour anchors (TOUR-09).
 * Tour definitions reference these semantic names; removing or renaming an
 * anchor silently breaks every tour step that targets it, so each anchor is
 * pinned to the component that must render it. Full render harnesses for
 * these hosts are heavyweight (Matrix/session contexts) — this guard is the
 * cheap invariant; real-browser resolution is covered by the Playwright
 * product-tour smoke.
 */
const anchorContract: Array<{ anchor: string; sourceFile: string }> = [
	{
		anchor: 'session-composer',
		sourceFile: 'messageSubmitInterface/TipTapComposer.tsx'
	},
	{
		anchor: 'livechat-availability-toggle',
		sourceFile: 'app/NavigationBar.tsx'
	},
	{
		anchor: 'livechat-queue',
		sourceFile: 'sessionsList/EnquiryFilterChips.tsx'
	},
	{
		anchor: 'groupchat-create-button',
		sourceFile: 'sessionsList/SessionsListToolbar.tsx'
	},
	{
		anchor: 'groupchat-call-button',
		sourceFile: 'sessionHeader/GroupChatHeader/index.tsx'
	}
];

describe('shared product-tour anchors', () => {
	it.each(anchorContract)(
		'$sourceFile carries data-tour-target="$anchor"',
		({ anchor, sourceFile }) => {
			const source = readFileSync(
				resolve(componentsRoot, sourceFile),
				'utf8'
			);

			expect(source).toContain(`data-tour-target="${anchor}"`);
		}
	);
});
