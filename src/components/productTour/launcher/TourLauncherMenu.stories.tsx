import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import {
	consultantMailCounsellingTour,
	consultantWalkthroughTour
} from '../tourDefinitions';
import type { TourDefinition } from '../types';
import { TourLauncherMenu } from './TourLauncherMenu';

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
				tourVersion: consultantWalkthroughTour.version,
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
		onOpen: fn()
	},
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
		// Four tours + "Rundgänge verwalten".
		await expect(rows).toHaveLength(5);
		await waitFor(() => expect(rows[0]).toHaveFocus());
		await expect(rows[0]).toHaveAccessibleName(
			/Neu starten: .* – Abgeschlossen/
		);
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
