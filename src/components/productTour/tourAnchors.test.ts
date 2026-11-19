import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { describe, expect, it } from 'vite-plus/test';

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
const anchorContract: Array<{
	anchor: string;
	sourceFile: string;
	/** The attribute may be conditional or passed through a prop. */
	expected?: RegExp;
}> = [
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
	},
	// Practice-area anchors (FE#1622). Only the nav item and the list card are
	// conditional: the nav item exists once per role, the card is the first
	// enquiry of the list.
	{
		// Every navigation item gets its `nav-<slug>` from one map…
		anchor: 'nav-enquiries',
		sourceFile: 'productTour/tourCatalogue.ts',
		expected: /'\/sessions\/consultant\/sessionPreview': 'nav-enquiries'/
	},
	{
		// …which the navigation bar renders on every item.
		anchor: 'nav-<slug>',
		sourceFile: 'app/NavigationBar.tsx',
		expected: /data-tour-target=\{navTourTarget\(\s*item\.to\s*\)\}/
	},
	{
		anchor: 'enquiry-list-item',
		sourceFile: 'sessionsListItem/SessionListItemComponent.tsx',
		expected: /data-tour-target=\{[^}]*'enquiry-list-item'[^}]*\}/
	},
	{
		anchor: 'enquiry-accept-button',
		sourceFile: 'session/AcceptAssign.tsx',
		expected: /tourTarget="enquiry-accept-button"/
	},
	{
		anchor: 'enquiry-team-button',
		sourceFile: 'session/SessionItemComponent.tsx',
		expected: /tourTarget="enquiry-team-button"/
	},
	{
		anchor: 'team-discussion-panel',
		sourceFile: 'session/SessionItemComponent.tsx'
	},
	{
		anchor: 'session-supervisor-add',
		sourceFile: 'sessionHeader/ChatroomMainInteractionIcon.tsx'
	},
	// Use-case tours (FE#2339).
	{
		anchor: 'sessions-search',
		sourceFile: 'sessionsList/SessionsListToolbar.tsx'
	},
	{
		// The first card of the list; the split button forwards it.
		anchor: 'case-handover-request-access',
		sourceFile: 'sessionsListItem/SessionListItemComponent.tsx',
		expected:
			/index === 0\s*\?\s*'case-handover-request-access'\s*:\s*undefined/
	},
	{
		anchor: 'groupchat-format-circle',
		sourceFile: 'conversationCreate/CreateConversationView.tsx',
		expected: /tourTarget="groupchat-format-circle"/
	},
	{
		anchor: 'groupchat-topic-picker',
		sourceFile: 'conversationCreate/CreateConversationView.tsx',
		expected: /tourTarget="groupchat-topic-picker"/
	},
	{
		anchor: 'supervision-panel',
		sourceFile: 'session/SessionItemComponent.tsx',
		expected: /data-tour-target="supervision-panel"/
	}
];

/** Hosts that forward an anchor prop to a real DOM attribute. */
const passThroughContract: Array<{ sourceFile: string; expected: RegExp }> = [
	{
		sourceFile: 'button/Button.tsx',
		expected: /data-tour-target=\{props\.tourTarget\}/
	},
	{
		sourceFile: 'chatStage/SidePanel.tsx',
		expected: /data-tour-target=\{tourTarget\}/
	},
	{
		sourceFile: 'splitButton/SplitButton.tsx',
		expected: /data-tour-target=\{tourTarget\}/
	},
	{
		sourceFile: 'sessionsListItem/CaseHandoverActionButton.tsx',
		expected: /tourTarget=\{tourTarget\}/
	},
	{
		sourceFile: 'conversationCreate/FormatCard.tsx',
		expected: /data-tour-target=\{tourTarget\}/
	}
];

describe('shared product-tour anchors', () => {
	it.each(anchorContract)(
		'$sourceFile carries data-tour-target="$anchor"',
		({ anchor, sourceFile, expected }) => {
			const source = readFileSync(
				resolve(componentsRoot, sourceFile),
				'utf8'
			);

			if (expected) {
				expect(expected.test(source)).toBe(true);
			} else {
				expect(source.includes(`data-tour-target="${anchor}"`)).toBe(
					true
				);
			}
		}
	);

	it.each(passThroughContract)(
		'$sourceFile forwards its anchor prop to data-tour-target',
		({ sourceFile, expected }) => {
			const source = readFileSync(
				resolve(componentsRoot, sourceFile),
				'utf8'
			);

			expect(expected.test(source)).toBe(true);
		}
	);
});
