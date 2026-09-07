import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, userEvent, waitFor } from 'storybook/test';
import { SessionMenu } from './SessionMenu';
import { MenuVerticalIcon } from '../../resources/img/icons';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import { stageRoute } from '../chatStage/__storybook__/chatStageFixtures';
import { phone390Globals } from '../message/messageStoryShell';
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
					'#597: trigger is horizontal 48×32 when closed and vertical 32×48 with 2px `--m3-primary-container` when `aria-expanded`.'
			}
		}
	}
} satisfies Meta<typeof SessionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	}
};

/** Isolated #597 trigger shape (closed vs open) without full session providers. */
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
				Closed 48×32 · click right for open 32×48
			</span>
		</div>
	);
}

export const MenuTriggerShape: Story = {
	tags: ['autodocs'],
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	},
	render: () => <MenuTriggerShapeDemo />
};

export const AnonymousMobileActions: Story = {
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
	await userEvent.click(
		canvasElement.querySelector<HTMLButtonElement>(
			'.sessionMenu__icon--desktop'
		)!
	);
	await waitFor(() =>
		expect(
			canvasElement.querySelector('.sessionMenu__content--open')
		).not.toBeNull()
	);
	return canvasElement.querySelector<HTMLElement>(
		'.sessionMenu__content--open'
	)!;
};

const withStage = (Story: React.ComponentType) => (
	<ChatStageProviders>
		<div style={{ position: 'relative', padding: 24, minHeight: 520 }}>
			<Story />
		</div>
	</ChatStageProviders>
);

/** D8 off (desktop): the calls are the header's own button group. */
export const CallsInTheHeader: Story = {
	name: 'Calls in the header row (desktop, D8 off)',
	tags: ['autodocs', '!needs-data'],
	parameters: { router: { initialPath: stageRoute } },
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
	parameters: { router: { initialPath: stageRoute } },
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
