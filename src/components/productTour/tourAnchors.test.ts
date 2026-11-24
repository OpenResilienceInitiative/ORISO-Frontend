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
		// "Where your tours live": the launcher switch in Help → Rundgänge
		// (the whole Help card is taller than a phone screen).
		anchor: 'help-tour-switch',
		sourceFile: 'profile/TourLauncherSwitch.tsx'
	},
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
		// Quick links own their tour anchor, including when the same route is
		// also available in the mobile dialog.
		anchor: 'nav-<slug>',
		sourceFile: 'app/NavigationBar.tsx',
		expected:
			/data-tour-target=\{\s*inMore\s*\?\s*undefined\s*:\s*navTourTarget\(\s*item\.to\s*\)\s*\}/
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
	// Profile section cards: `tourTarget` in the route files.
	{
		anchor: 'profile-public',
		sourceFile: 'profile/profile.routes.ts',
		expected: /tourTarget: 'profile-public'/
	},
	{
		anchor: 'profile-absence',
		sourceFile: 'profile/profile.routes.ts',
		expected: /tourTarget: 'profile-absence'/
	},
	{
		anchor: 'profile-notifications',
		sourceFile: 'profile/profileSettings.routes.ts',
		expected: /tourTarget: 'profile-notifications'/
	},
	{
		anchor: 'profile-security',
		sourceFile: 'profile/profileSettings.routes.ts',
		expected: /tourTarget: 'profile-security'/
	},
	{
		anchor: 'profile-display',
		sourceFile: 'profile/profileSettings.routes.ts',
		expected: /tourTarget: 'profile-display'/
	},
	{
		anchor: 'profile-shortcuts',
		sourceFile: 'profile/profileSettings.routes.ts',
		expected: /tourTarget: 'profile-shortcuts'/
	},
	{
		anchor: 'profile-help-tours',
		sourceFile: 'profile/profileHelp.routes.ts',
		expected: /tourTarget: 'profile-help-tours'/
	},
	// Calendar (keep edits to the attribute; FE#2326 touches the sidebar).
	{
		anchor: 'calendar-create',
		sourceFile: 'calendar/CalendarPage.tsx'
	},
	{
		anchor: 'calendar-settings',
		sourceFile: 'calendar/CalendarPage.tsx'
	},
	{
		// Digits and the pill menu never render together; both carry it.
		anchor: 'calendar-view-switch',
		sourceFile: 'calendar/CalendarPage.tsx',
		expected:
			/data-tour-target="calendar-view-switch"[\s\S]*data-tour-target="calendar-view-switch"/
	},
	{
		// Only while the quick panel is not hidden.
		anchor: 'calendar-quick-entry',
		sourceFile: 'calendar/CalendarSidebar.tsx',
		expected: /\?\s*undefined\s*:\s*'calendar-quick-entry'/
	},
	{
		anchor: 'calendar-working-hours',
		sourceFile: 'calendar/CalendarSidebar.tsx'
	},
	{
		anchor: 'calendar-links',
		sourceFile: 'calendar/CalendarLinksSection.tsx'
	},
	{
		anchor: 'supervision-panel',
		sourceFile: 'session/SessionItemComponent.tsx',
		expected: /data-tour-target="supervision-panel"/
	},
	// Asker tours (FE#2343). The list wrapper keeps the counsellor anchor and
	// renders the neutral alias for advice seekers.
	{
		anchor: 'sessions-list',
		sourceFile: 'sessionsList/SessionsList.tsx',
		expected:
			/AUTHORITIES\.ASKER_DEFAULT, userData\)\s*\?\s*'sessions-list'\s*:\s*'consultant-sessions-list'/
	},
	{
		anchor: 'profile-overview',
		sourceFile: 'profile/Profile.tsx'
	},
	// Settings cards: anchored inside each card's own component, so the
	// card shell stays untouched. The three notification variants share one
	// anchor; only one of them renders the first match.
	{
		anchor: 'settings-password',
		sourceFile: 'passwordReset/PasswordReset.tsx'
	},
	{
		anchor: 'settings-2fa',
		sourceFile: 'twoFactorAuth/TwoFactorAuth.tsx'
	},
	{
		anchor: 'settings-recovery',
		sourceFile: 'profile/SecurityPrivacySettings.tsx'
	},
	{
		anchor: 'settings-delete-account',
		sourceFile: 'profile/DeleteAccount.tsx'
	},
	{
		anchor: 'settings-notifications',
		sourceFile: 'profile/EmailNotifications/index.tsx'
	},
	{
		anchor: 'settings-notifications',
		sourceFile: 'profile/NotificationSettings/index.tsx'
	},
	{
		anchor: 'settings-notifications',
		sourceFile: 'profile/BrowserNotifications/index.tsx'
	},
	{
		anchor: 'settings-display',
		sourceFile: '../features/menu-effects/MenuEffectsSettings.tsx'
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
	},
	{
		sourceFile: 'profile/ProfileCard.tsx',
		expected: /data-tour-target=\{tourTarget\}/
	},
	{
		sourceFile: 'profile/ProfileCardList.tsx',
		expected: /tourTarget=\{element\.tourTarget\}/
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
