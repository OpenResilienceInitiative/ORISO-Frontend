import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import {
	consultantMailCounsellingTour,
	consultantWalkthroughTour
} from '../tourDefinitions';
import type { TourDefinition } from '../types';
import {
	TourLauncherMenu,
	type TourLauncherMenuProps
} from './TourLauncherMenu';
import type { TourLauncherPosition } from './tourLauncherPosition';

const FAB_MENU_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9748-60084';

/** Stand-ins for topic tours of other packages, so the card shows its length. */
const topic = (id: string, titleKey: string): TourDefinition => ({
	...consultantMailCounsellingTour,
	id,
	titleKey
});

const COUNSELLOR_TOURS: TourDefinition[] = [
	consultantWalkthroughTour,
	consultantMailCounsellingTour,
	topic('story-profile', 'profile.routes.settings.title'),
	topic('story-calendar', 'navigation.booking.events')
];

const meta = {
	title: 'Components/ProductTour/TourLauncherMenu',
	component: TourLauncherMenu,
	tags: ['autodocs'],
	args: {
		tours: COUNSELLOR_TOURS,
		progress: [
			{
				tourId: consultantWalkthroughTour.id,
				tourVersion: 1,
				status: 'completed'
			},
			{
				tourId: consultantMailCounsellingTour.id,
				tourVersion: 1,
				status: 'in_progress'
			}
		],
		onStartTour: fn(),
		onManage: fn(),
		onOpen: fn(),
		onMove: fn(),
		onHide: fn()
	},
	// Like the app: the position and the hidden flag live outside the menu.
	render: (args) => <StatefulLauncher {...args} />,
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: FAB_MENU_FIGMA_URL },
		docs: {
			description: {
				component:
					'The "?" tour launcher (FE#2340): the design-system FAB (Figma 9748:60084) bottom-right, opening the chat menu organism with one row per tour and its status. ' +
					'In the app it shows only while no conversation is open, no call runs, no tour runs and no other floating button is on screen.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div
				style={{
					minHeight: '100vh',
					background: 'var(--m3-surface, #fff)'
				}}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof TourLauncherMenu>;

/**
 * Keeps what `TourLauncherFab` keeps in storage (the position, the hidden
 * flag) in state, so drag, reset and hide behave as in the app.
 */
function StatefulLauncher(args: TourLauncherMenuProps) {
	const [position, setPosition] = useState<TourLauncherPosition | null>(
		args.position ?? null
	);
	const [hidden, setHidden] = useState(false);
	if (hidden) return null;
	return (
		<TourLauncherMenu
			{...args}
			position={position}
			onMove={(next) => {
				args.onMove?.(next);
				setPosition(next);
			}}
			onHide={() => {
				args.onHide?.();
				setHidden(true);
			}}
		/>
	);
}

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const fab = canvas.getByRole('button', { name: 'Rundgänge öffnen' });
		await expect(fab).toHaveAttribute('aria-expanded', 'false');
	}
};

export const OpenWithProgress: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Rundgänge öffnen' })
		);
		await expect(args.onOpen).toHaveBeenCalled();
		const menu = await canvas.findByRole('menu', { name: 'Rundgänge' });
		const rows = within(menu).getAllByRole('menuitem');
		// Four tours + "Rundgänge verwalten" + "Hilfe-Button ausblenden";
		// "Position zurücksetzen" only shows once the "?" was moved.
		await expect(rows).toHaveLength(6);
		await waitFor(() => expect(rows[0]).toHaveFocus());
		await expect(rows[0]).toHaveAccessibleName(
			/Nochmal starten: .* – Abgeschlossen/
		);
		await expect(
			within(menu).queryByRole('menuitem', {
				name: 'Position zurücksetzen'
			})
		).toBeNull();
		await expect(rows[1]).toHaveAccessibleName(
			/Fortsetzen: .* – In Bearbeitung/
		);
		await userEvent.click(rows[1]);
		await expect(args.onStartTour).toHaveBeenCalledWith(
			consultantMailCounsellingTour,
			'continue'
		);
		await expect(canvas.queryByRole('menu')).toBeNull();
	}
};

export const KeyboardAndEscape: Story = {
	args: { defaultOpen: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const menu = await canvas.findByRole('menu');
		await userEvent.keyboard('{End}');
		await expect(
			within(menu).getByRole('menuitem', {
				name: 'Hilfe-Button ausblenden'
			})
		).toHaveFocus();
		await userEvent.keyboard('{ArrowUp}');
		await expect(
			within(menu).getByRole('menuitem', { name: 'Rundgänge verwalten' })
		).toHaveFocus();
		await userEvent.keyboard('{Escape}');
		await expect(canvas.queryByRole('menu')).toBeNull();
		await expect(
			canvas.getByRole('button', { name: 'Rundgänge öffnen' })
		).toHaveFocus();
	}
};

export const AskerTwoTours: Story = {
	args: {
		defaultOpen: true,
		tours: [
			topic('story-asker-first', 'tour.launcher.title'),
			topic('story-asker-settings', 'profile.routes.settings.title')
		],
		progress: []
	}
};

export const Phone390Open: Story = {
	args: { defaultOpen: true },
	globals: phone390Globals
};

const fabOf = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole('button', {
		name: /Rundgänge (öffnen|schließen)/
	});
const launcherOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('[data-cy="tour-launcher"]')!;

/** A real pointer drag: press, move past the 6 px threshold, release. */
const drag = (target: HTMLElement, toX: number, toY: number) => {
	const box = target.getBoundingClientRect();
	const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
	const pointer = (type: string, x: number, y: number) =>
		target.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				pointerId: 7,
				pointerType: 'mouse',
				button: 0,
				clientX: x,
				clientY: y
			})
		);
	pointer('pointerdown', from.x, from.y);
	pointer('pointermove', from.x - 10, from.y - 10);
	pointer('pointermove', toX, toY);
	pointer('pointerup', toX, toY);
	target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

/** The whole card must stay on screen, whichever corner the "?" is in. */
const expectCardOnScreen = async (canvasElement: HTMLElement) => {
	const card = await within(canvasElement).findByRole('menu');
	await waitFor(() => {
		const rect = card
			.closest<HTMLElement>('.tourLauncher__card')!
			.getBoundingClientRect();
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
		expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
	});
};

export const MovedBottomLeft: Story = {
	name: 'Moved · bottom-left',
	args: {
		defaultOpen: true,
		position: { h: 'left', x: 16, v: 'bottom', y: 56 }
	},
	parameters: {
		docs: {
			description: {
				story: 'Dragged to the bottom-left (FE#2545): the card opens to the right, above the button, and offers "Position zurücksetzen".'
			}
		}
	},
	play: async ({ canvasElement, args }) => {
		await expect(launcherOf(canvasElement)).toHaveAttribute(
			'data-position',
			'bottom-left'
		);
		await expectCardOnScreen(canvasElement);
		const menu = within(canvasElement).getByRole('menu');
		await userEvent.click(
			within(menu).getByRole('menuitem', {
				name: 'Position zurücksetzen'
			})
		);
		await expect(args.onMove).toHaveBeenLastCalledWith(null);
		await expect(launcherOf(canvasElement)).toHaveAttribute(
			'data-position',
			'default'
		);
		await expect(fabOf(canvasElement)).toHaveFocus();
	}
};

export const MovedTop: Story = {
	name: 'Moved · top-right',
	args: {
		defaultOpen: true,
		position: { h: 'right', x: 16, v: 'top', y: 16 }
	},
	parameters: {
		docs: {
			description: {
				story: 'Dragged to the top: the card opens below the button and fits the space left under it.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expect(launcherOf(canvasElement)).toHaveAttribute(
			'data-position',
			'top-right'
		);
		await expectCardOnScreen(canvasElement);
		const fab = fabOf(canvasElement).getBoundingClientRect();
		const card = canvasElement
			.querySelector<HTMLElement>('.tourLauncher__card')!
			.getBoundingClientRect();
		await expect(card.top).toBeGreaterThanOrEqual(fab.bottom);
	}
};

export const DragAndKeyboard: Story = {
	name: 'Drag, Alt+arrows and click',
	play: async ({ canvasElement, args }) => {
		const fab = fabOf(canvasElement);
		// The grip and its tooltip.
		await expect(
			canvasElement.querySelector('[data-cy="tour-launcher-grip"]')
		).toHaveAttribute('title', 'Ziehen zum Verschieben');
		drag(fab, 80, window.innerHeight - 120);
		await waitFor(() =>
			expect(launcherOf(canvasElement)).toHaveAttribute(
				'data-position',
				'bottom-left'
			)
		);
		// A drag does not open the menu.
		await expect(within(canvasElement).queryByRole('menu')).toBeNull();
		const before = fab.getBoundingClientRect();
		fab.focus();
		await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
		await waitFor(() =>
			expect(
				Math.round(fab.getBoundingClientRect().left - before.left)
			).toBe(16)
		);
		await expect(args.onMove).toHaveBeenCalledTimes(2);
		// A plain click still opens the menu.
		await userEvent.click(fab);
		await expect(
			await within(canvasElement).findByRole('menu')
		).toBeVisible();
		await expectCardOnScreen(canvasElement);
	}
};

export const HideConfirm: Story = {
	name: 'Hide, with confirm',
	args: { defaultOpen: true },
	parameters: {
		docs: {
			description: {
				story: '"Hilfe-Button ausblenden" asks inside the same row first and says where to undo it; the second press hides the "?". It comes back under Profil → Hilfe → Rundgänge.'
			}
		}
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const item = await canvas.findByRole('menuitem', {
			name: 'Hilfe-Button ausblenden'
		});
		await userEvent.click(item);
		await expect(item).toHaveAccessibleName(
			'Ausblenden? Wieder einblenden unter Hilfe → Rundgänge'
		);
		await expect(
			within(item).getByText('Wieder einblenden unter Hilfe → Rundgänge')
		).toBeVisible();
		await expect(args.onHide).not.toHaveBeenCalled();
		await userEvent.click(item);
		await expect(args.onHide).toHaveBeenCalledTimes(1);
		await expect(
			canvas.queryByRole('button', { name: /Rundgänge/ })
		).toBeNull();
	}
};

export const HideConfirmPending: Story = {
	name: 'Hide, confirm step (screenshot)',
	args: { defaultOpen: true },
	play: async ({ canvasElement }) => {
		const item = await within(canvasElement).findByRole('menuitem', {
			name: 'Hilfe-Button ausblenden'
		});
		await userEvent.click(item);
		await expect(item).toHaveAttribute('data-confirm', 'true');
	}
};

export const CompletedTours: Story = {
	name: 'Completed tours with dates',
	args: {
		defaultOpen: true,
		progress: [
			{
				tourId: consultantWalkthroughTour.id,
				tourVersion: consultantWalkthroughTour.version,
				status: 'completed',
				completedAt: '2026-07-07T10:00:00Z'
			},
			{
				tourId: consultantMailCounsellingTour.id,
				tourVersion: consultantMailCounsellingTour.version,
				status: 'completed',
				completedAt: null
			}
		]
	},
	play: async ({ canvasElement }) => {
		const menu = await within(canvasElement).findByRole('menu');
		const [dated, undated] = within(menu).getAllByRole('menuitem');
		await expect(dated).toHaveAccessibleName(
			/Nochmal starten: .* – Abgeschlossen am 7\. Juli 2026/
		);
		await expect(
			within(dated).getByText('Abgeschlossen am 7. Juli 2026')
		).toBeVisible();
		await expect(
			within(dated).getByTestId('tour-completed-icon')
		).toBeInTheDocument();
		await expect(undated).toHaveAccessibleName(
			/Nochmal starten: .* – Abgeschlossen$/
		);
		await expect(
			within(undated).getByTestId('tour-completed-icon')
		).toBeInTheDocument();
	}
};
