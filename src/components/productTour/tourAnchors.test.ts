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
		// Moved off the unmounted EnquiryFilterChips onto the live-chat chip
		// of the conversations toolbar (FE#2342).
		anchor: 'livechat-queue',
		sourceFile: 'sessionsList/SessionsListToolbar.tsx',
		expected: /tourTarget: 'livechat-queue'/
	},
	{
		anchor: 'livechat-availability-settings',
		sourceFile: 'profile/LiveChatAvailability.tsx'
	},
	{
		// On every root: phone empty, desktop empty split, filled list.
		anchor: 'timeline-page',
		sourceFile: 'notificationsCenter/NotificationsCenter.tsx',
		expected: /(data-tour-target="timeline-page"[\s\S]*){3}/
	},
	{
		anchor: 'timeline-filters',
		sourceFile: 'notificationsCenter/NotificationsCenter.tsx',
		expected: /'timeline-filters'/
	},
	{
		anchor: 'timeline-mark-all-read',
		sourceFile: 'notificationsCenter/NotificationsCenter.tsx',
		expected: /'timeline-mark-all-read'/
	},
	{
		anchor: 'sessions-drafts-chip',
		sourceFile: 'sessionsList/SessionsListToolbar.tsx',
		expected: /tourTarget: 'sessions-drafts-chip'/
	},
	{
		anchor: 'drafts-center',
		sourceFile: 'draftsCenter/DraftsCenter.tsx'
	},
	{
		// Header video button only; never the ⋮ triggers or the call itself.
		anchor: 'session-video-call-button',
		sourceFile: 'sessionMenu/SessionMenu.tsx',
		expected: /tourTarget="session-video-call-button"/
	},
	{
		anchor: 'help-video-call',
		sourceFile: 'help/Help.tsx'
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
		sourceFile: 'notificationsCenter/MarkAllReadButton.tsx',
		expected: /data-tour-target=\{tourTarget\}/
	},
	{
		sourceFile: 'displayFilter/FilterChip.tsx',
		expected: /data-tour-target=\{tourTarget\}/
	},
	{
		// The toolbar binds each chip's configured anchor to the shared chip.
		sourceFile: 'sessionsList/SessionsListToolbar.tsx',
		expected: /tourTarget=\{chip\.tourTarget\}/
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
