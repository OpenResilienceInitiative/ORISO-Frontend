import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { SessionMenu } from './SessionMenu';
import { MenuVerticalIcon } from '../../resources/img/icons';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	stageRoute,
	stageSession
} from '../chatStage/__storybook__/chatStageFixtures';
import { phone390Globals } from '../message/messageStoryShell';
import { SupervisionPanelContext } from '../supervisionPanel/SupervisionPanelContext';
import { AUTHORITIES, UserDataContext } from '../../globalState';
import { counsellorUserData } from '../chatStage/__storybook__/chatStageFixtures';
import type { UserDataInterface } from '../../globalState/interfaces';
import './sessionMenu.styles.scss';

const hasUserInitiatedStopOrLeaveRequest = {
	current: false
};

const meta = {
	title: 'Organisms/SessionMenu',
	component: SessionMenu,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Session header flyout menu with archive/delete, group-chat actions, legal links and (consultant) video/audio call buttons. ' +
					'The trigger keeps the same size when opened, with a 2px `--m3-primary-container` highlight.'
			}
		}
	}
} satisfies Meta<typeof SessionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const stageFrame = (Story: React.ComponentType) => (
	<div style={{ position: 'relative', padding: 24, minHeight: 520 }}>
		<Story />
	</div>
);

const withStage = (Story: React.ComponentType) => (
	<ChatStageProviders>{stageFrame(Story)}</ChatStageProviders>
);

// The menu reads the session and router; the stage provides them (#1338).
export const Default: Story = {
	tags: ['autodocs', '!needs-data'],
	parameters: { router: { initialPath: stageRoute } },
	decorators: [withStage],
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	}
};

/** Stable trigger geometry in closed and open states. */
function MenuTriggerShapeDemo() {
	const [expanded, setExpanded] = useState(false);
	return (
		<div
			style={{
				display: 'flex',
				gap: 24,
				alignItems: 'center',
				padding: 24,
				background: '#eae7e8'
			}}
		>
			<button
				type="button"
				className="sessionMenu__icon sessionMenu__icon--desktop"
				aria-expanded={false}
				aria-label="Menu closed"
				style={{ display: 'inline-flex' }}
			>
				<MenuVerticalIcon />
			</button>
			<button
				type="button"
				className="sessionMenu__icon sessionMenu__icon--desktop"
				aria-expanded={expanded}
				aria-label="Menu open toggle"
				style={{ display: 'inline-flex' }}
				onClick={() => setExpanded((v) => !v)}
			>
				<MenuVerticalIcon />
			</button>
			<span style={{ fontSize: 12, color: '#4C555F' }}>
				Stable 44×44 · click the right trigger to toggle its open state
			</span>
		</div>
	);
}

export const MenuTriggerShape: Story = {
	tags: ['autodocs', '!needs-data'],
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	},
	render: () => <MenuTriggerShapeDemo />
};

export const AnonymousMobileActions: Story = {
	tags: ['autodocs', '!needs-data'],
	parameters: { router: { initialPath: stageRoute } },
	decorators: [withStage],
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: false,
		showMobileEndAnonymousChatAction: true,
		onMobileEndAnonymousChatAction: () => {},
		showMobileDeleteAnonymousAccountAction: true,
		onMobileDeleteAnonymousAccountAction: () => {}
	}
};

/*
 * ---------------------------------------------------------------------------
 * D8 (Frank, 05.09.2026): on the phone the audio/video call buttons leave the
 * header row and become rows of THIS menu, because the conversation title
 * needs the width. `SessionMenu.tsx` got the `callsInMenu` prop for it, but
 * this story file was never touched — until 07.09. the decision was only
 * checked two levels away, in `Templates/ConsultantSessionStage` "(e)".
 * `grep -rn "callsInMenu" src --include='*.stories.tsx'` had zero hits.
 * ---------------------------------------------------------------------------
 */

const openTheKebab = async (canvasElement: HTMLElement) => {
	// Click the trigger a person can see: the other one is display:none, and a
	// menu whose trigger is hidden closes on the next resize.
	const trigger = await waitFor(() => {
		const visible = Array.from(
			canvasElement.querySelectorAll<HTMLButtonElement>(
				'.sessionMenu__icon'
			)
		).find((button) => button.getClientRects().length > 0);
		expect(visible).toBeTruthy();
		return visible!;
	});
	await userEvent.click(trigger);
	// The flyout is portalled to <body>, outside the canvas.
	await waitFor(() =>
		expect(
			document.querySelector('.sessionMenu__content--open')
		).not.toBeNull()
	);
	return document.querySelector<HTMLElement>('.sessionMenu__content--open')!;
};

const withGroupStage = (Story: React.ComponentType) => (
	<ChatStageProviders activeSession={{ ...stageSession(), isGroup: true }}>
		{stageFrame(Story)}
	</ChatStageProviders>
);

const withSupervisionStage = (Story: React.ComponentType) => (
	<ChatStageProviders>
		<SupervisionPanelContext.Provider
			value={{
				visible: true,
				available: true,
				isExpanded: false,
				unreadCount: 0,
				expand: () => {}
			}}
		>
			{stageFrame(Story)}
		</SupervisionPanelContext.Provider>
	</ChatStageProviders>
);

/** D8 off (desktop): the calls are the header's own button group. */
export const CallsInTheHeader: Story = {
	name: 'Calls in the header row (desktop, D8 off)',
	tags: ['autodocs', '!needs-data'],
	parameters: {
		router: { initialPath: stageRoute }
	},
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	},
	decorators: [withStage],
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.sessionMenu__icon--desktop')
			).not.toBeNull()
		);
		// The buttons sit in the header row …
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'[data-cy="session-header-video-call-buttons"]'
				)
			).not.toBeNull()
		);
		// … and NOT in the menu.
		const flyout = await openTheKebab(canvasElement);
		await expect(
			flyout.querySelector('[data-cy="session-menu-start-video-call"]')
		).toBeNull();
		await expect(
			flyout.querySelector('[data-cy="session-menu-start-call"]')
		).toBeNull();
	}
};

/**
 * D8 on (phone): the header button group is gone and the two calls are rows
 * of the menu — real `<button>`s with the visible title as their name
 * (review v10), same feature gates as the header buttons.
 */
export const CallsInTheKebabMenu: Story = {
	name: 'Calls in the kebab menu (phone, D8)',
	tags: ['autodocs', '!needs-data'],
	globals: phone390Globals,
	parameters: {
		router: { initialPath: stageRoute }
	},
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true,
		callsInMenu: true
	},
	decorators: [withStage],
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.sessionMenu__icon--desktop')
			).not.toBeNull()
		);
		// The header's button group is gone …
		await expect(
			canvasElement.querySelector('.sessionMenu__videoCallButtons')
		).toBeNull();
		// … and the two calls are rows of the menu.
		const flyout = await openTheKebab(canvasElement);
		const video = flyout.querySelector<HTMLElement>(
			'[data-cy="session-menu-start-video-call"]'
		)!;
		const audio = flyout.querySelector<HTMLElement>(
			'[data-cy="session-menu-start-call"]'
		)!;
		await expect(video).not.toBeNull();
		await expect(audio).not.toBeNull();
		for (const row of [video, audio]) {
			// Real controls, not `div onClick` (review v10).
			await expect(row.tagName).toBe('BUTTON');
			await expect((row as HTMLButtonElement).type).toBe('button');
			await expect(row.tabIndex).toBe(0);
			await expect(row.textContent?.trim().length).toBeGreaterThan(0);
			await waitFor(() => {
				row.focus();
				expect(document.activeElement).toBe(row);
			});
		}
		await expect(
			video.querySelector('[data-icon-id="ui-icon:modality-video:base"]')
		).not.toBeNull();
		await expect(
			audio.querySelector(
				'[data-icon-id="ui-icon:timeline-add-call:base"]'
			)
		).not.toBeNull();

		const rowNamed = (label: string) =>
			Array.from(
				flyout.querySelectorAll<HTMLElement>(
					'.sessionMenu__item.chatMenuDropdown__item'
				)
			).find((row) => row.textContent?.includes(label));
		await expect(
			rowNamed('Ratsuchendenprofil')?.querySelector(
				'[data-icon-id="sidebar-icon:profil:outline"]'
			)
		).not.toBeNull();
		await expect(
			rowNamed('Benachrichtigungen einstellen')?.querySelector(
				'[data-icon-id="ui-icon:notification-settings:base"]'
			)
		).not.toBeNull();
		await expect(
			rowNamed('Rat einholen')?.querySelector(
				'[data-icon-id="ui-icon:persons-two:base"]'
			)
		).not.toBeNull();
		await expect(
			rowNamed('Archivieren')?.querySelector(
				'[data-icon-id="sidebar-icon:inbox:outline"]'
			)
		).not.toBeNull();
		await expect(
			rowNamed('Löschen')?.querySelector(
				'[data-icon-id="ui-icon:trash:base"]'
			)
		).not.toBeNull();
	}
};

/** Group menus must not expose the one-to-one advice action. */
export const GroupOmitsOneToOneAdvice: Story = {
	name: 'Group — no one-to-one advice row',
	tags: ['autodocs', '!needs-data'],
	parameters: { router: { initialPath: stageRoute } },
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	},
	decorators: [withGroupStage],
	play: async ({ canvasElement }) => {
		const flyout = await openTheKebab(canvasElement);
		await expect(
			flyout.querySelector('[data-cy="session-menu-request-advice"]')
		).toBeNull();
		await expect(
			flyout.querySelector('[data-icon-id="ui-icon:persons-two:base"]')
		).toBeNull();
	}
};

/** The parallel supervision row uses the catalogued supervision glyph. */
export const SupervisionUsesCatalogIcon: Story = {
	name: 'Supervision — catalog icon',
	tags: ['autodocs', '!needs-data'],
	parameters: {
		router: { initialPath: stageRoute }
	},
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	},
	decorators: [withSupervisionStage],
	play: async ({ canvasElement }) => {
		const flyout = await openTheKebab(canvasElement);
		const supervision = flyout.querySelector<HTMLElement>(
			'[data-cy="session-menu-supervision-panel"]'
		)!;
		await expect(supervision).not.toBeNull();
		await expect(
			supervision.querySelector(
				'[data-icon-id="ui-icon:supervision-nocirc:400"]'
			)
		).not.toBeNull();
	}
};

/** A supervisor never starts a call from the side room — no rows either way. */
export const SupervisorHasNoCalls: Story = {
	name: 'Supervisor — no call rows (D8 gate)',
	tags: ['autodocs', '!needs-data'],
	parameters: { router: { initialPath: stageRoute } },
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true,
		callsInMenu: true,
		isSupervisor: true
	},
	decorators: [withStage],
	play: async ({ canvasElement }) => {
		const flyout = await openTheKebab(canvasElement);
		await expect(
			flyout.querySelector('[data-cy="session-menu-start-video-call"]')
		).toBeNull();
		await expect(
			flyout.querySelector('[data-cy="session-menu-start-call"]')
		).toBeNull();
		await expect(
			canvasElement.querySelector('.sessionMenu__videoCallButtons')
		).toBeNull();
	}
};

/**
 * FE#2250: the owning counsellor of a 1:1 chat finds "Beratung übergeben"
 * directly below "Weitere Beratung empfehlen". It opens the same handover
 * dialog as the profile button (pinned by SessionMenu.caseHandover.test.tsx).
 */
export const CaseHandoverBelowRecommend: Story = {
	name: 'Owner — Beratung übergeben below the recommendation',
	tags: ['autodocs', '!needs-data'],
	parameters: { router: { initialPath: stageRoute } },
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	},
	decorators: [withStage],
	play: async ({ canvasElement }) => {
		const flyout = await openTheKebab(canvasElement);
		const rows = Array.from(
			flyout.querySelectorAll<HTMLElement>(
				'.sessionMenu__item.chatMenuDropdown__item'
			)
		);
		const recommendAt = rows.findIndex(
			(row) =>
				row.dataset.cy === 'session-menu-recommend-further-counselling'
		);
		await expect(recommendAt).toBeGreaterThanOrEqual(0);
		await expect(rows[recommendAt + 1]?.dataset.cy).toBe(
			'session-menu-case-handover'
		);
		await expect(rows[recommendAt + 1]?.textContent).toContain(
			'Beratung übergeben'
		);
	}
};

const askerUserData = {
	...counsellorUserData,
	userId: 'asker-storybook',
	userName: 'sonnenblume',
	displayName: '',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
	userRoles: ['USER']
} as unknown as UserDataInterface;

const askerUserDataValue = {
	userData: askerUserData,
	setUserData: () => {},
	reloadUserData: async () => askerUserData
};

/** The stage, seen by the advice seeker of the conversation. */
const withAskerStage = (Story: React.ComponentType) => (
	<ChatStageProviders>
		<UserDataContext.Provider value={askerUserDataValue}>
			{stageFrame(Story)}
		</UserDataContext.Provider>
	</ChatStageProviders>
);

/** Tomorrow, 15:00–16:00: always upcoming, whatever day the story runs. */
const tomorrowAt = (hour: number) => {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	date.setHours(hour, 0, 0, 0);
	return date.toISOString();
};

/**
 * Only counsellors start calls (product owner, 17 Nov 2026). The advice
 * seeker sees the same video and audio buttons, but a click opens the
 * conversation's next appointment instead of a call. The appointment read is
 * served by a fixture.
 */
export const AdviceSeekerCallButtonsShowAppointment: Story = {
	name: 'Advice seeker — call buttons show the appointment',
	tags: ['autodocs', '!needs-data'],
	parameters: { router: { initialPath: stageRoute } },
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: false
	},
	decorators: [withAskerStage],
	beforeEach: () => {
		const originalFetch = globalThis.fetch;
		const fixture: typeof fetch = async (input, init) => {
			const url = new URL(new Request(input, init).url);
			if (/\/users\/sessions\/-?\d+\/appointments$/.test(url.pathname)) {
				return Response.json([
					{
						id: 'storybook-appointment',
						sessionId: 1,
						startTime: tomorrowAt(15),
						endTime: tomorrowAt(16),
						status: 'SCHEDULED',
						kind: 'VIDEO'
					}
				]);
			}
			return originalFetch(input, init);
		};
		globalThis.fetch = fixture;
		return () => {
			if (globalThis.fetch === fixture) globalThis.fetch = originalFetch;
		};
	},
	play: async ({ canvasElement }) => {
		const video = await waitFor(() => {
			const button = canvasElement.querySelector<HTMLElement>(
				'[data-cy="session-header-start-video-call"]'
			);
			expect(button).not.toBeNull();
			return button!;
		});
		await userEvent.click(video);
		const card = await waitFor(() => {
			const found = document.querySelector<HTMLElement>(
				'[data-testid="asker-call-info-appointment"]'
			);
			expect(found).not.toBeNull();
			return found!;
		});
		await expect(card.textContent).toMatch(/Videoanruf|Video call/);
	}
};

/** A counsellor opens the team conversation from the existing More menu. */
export const TeamChatInMoreMenu: Story = {
	name: 'Team-Chat im Mehr-Menü',
	tags: ['autodocs', '!needs-data'],
	parameters: { router: { initialPath: stageRoute } },
	decorators: [withStage],
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true,
		onOpenTeamChat: fn(),
		teamChatUnreadCount: 2
	},
	play: async ({ canvasElement, args }) => {
		const flyout = await openTheKebab(canvasElement);
		await expect(
			canvasElement.querySelector('.sessionMenu__teamUnread')
		).toHaveTextContent('2');
		const item = flyout.querySelector<HTMLButtonElement>(
			'[data-cy="session-menu-team-chat"]'
		);
		await expect(item).not.toBeNull();
		await userEvent.click(item!);
		await expect(args.onOpenTeamChat).toHaveBeenCalledTimes(1);
	}
};
