import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotificationSettingsPanel } from './index';
import { APP_ORISO_FIGMA_URL } from '../../storybookDesignLinks';
import { notificationSettingsStore } from '../../../utils/notificationSettings/store';
import { expect, userEvent, within } from 'storybook/test';
import { withDisplayFilterStore } from '../../displayFilter/displayFilterStoryStore';
import {
	DEFAULT_DISPLAY_FILTERS,
	withGlobalFilter,
	withSectionOverride
} from '../../../utils/displayFilter/model';

/**
 * The panel runs on the Slice 6a settings store, which works without a Matrix
 * client (defaults / localStorage mirror) — so stories only need to seed the
 * store into the desired state.
 */
const withStoreState =
	(prepare: () => void) => (Story: React.ComponentType) => {
		const Seeded = () => {
			// Every story seeds its own state; a reset on unmount would race
			// with the next story's seeding and wipe it.
			prepare();
			return (
				<div style={{ maxWidth: 480, padding: 16 }}>
					<Story />
				</div>
			);
		};
		return <Seeded />;
	};

const meta = {
	title: 'Organisms/NotificationSettingsPanel',
	component: NotificationSettingsPanel,
	tags: ['autodocs'],
	decorators: [withDisplayFilterStore],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'WP-06 Slice 6b: cross-device notification settings (Matrix account data — global mute, per-family toggles, browser notifications incl. privacy preview toggle, sounds) plus the device-scoped "silence this device" switch (MSC3890 pattern). In Storybook the store runs on its localStorage-mirror fallback.'
			}
		}
	}
} satisfies Meta<typeof NotificationSettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Defaults: everything on except browser notifications + preview. */
export const Default: Story = {
	decorators: [
		withStoreState(() => notificationSettingsStore.resetForTests())
	]
};

/** Account-wide mute engaged — every other toggle stays as configured. */
export const GloballyMuted: Story = {
	decorators: [
		withStoreState(() => {
			notificationSettingsStore.resetForTests();
			notificationSettingsStore.updateSettings({ globalMute: true });
		})
	]
};

/** Only this device silenced; some families switched off. */
export const DeviceSilenced: Story = {
	decorators: [
		withStoreState(() => {
			notificationSettingsStore.resetForTests();
			notificationSettingsStore.setDeviceSilenced(true);
			notificationSettingsStore.updateSettings({
				families: { system: false, drafts: false }
			});
		})
	]
};

/**
 * #1377 slice 6: the display-filter defaults per list, a per-event-type
 * hide in the Zeitstrahl (System shows as "mixed"), and a Gespräche list
 * that currently runs its own override (hint shown).
 */
export const DisplayFilters: Story = {
	decorators: [
		withStoreState(() => notificationSettingsStore.resetForTests())
	],
	parameters: {
		displayFilters: withSectionOverride(
			withGlobalFilter(DEFAULT_DISPLAY_FILTERS, 'timeline', {
				kinds: { drafts: { show: true, pill: false } },
				autoReadHidden: true,
				hiddenEventTypes: ['supervisor.added']
			}),
			'sessions',
			{
				kinds: { circle: { show: false, pill: false } },
				autoReadHidden: false
			}
		)
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole('checkbox', { name: 'In der Liste: System' })
		).toHaveAttribute('aria-checked', 'mixed');
		// Entwürfe is a row in the Zeitstrahl AND the Gespräche section
		// (Frank 2026-09-16: every chip a row), so scope to the timeline.
		const timeline = within(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="display-filter-profile-timeline"]'
			)!
		);
		await expect(
			timeline.getByRole('button', { name: 'Im Filter: Entwürfe' })
		).toHaveTextContent('Aus');
		const sessions = within(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="display-filter-profile-sessions"]'
			)!
		);
		await expect(
			sessions.getByRole('button', { name: 'Im Filter: Ungelesen' })
		).toHaveTextContent('An');
		await expect(
			canvas.getByText(
				'Diese Liste nutzt gerade einen eigenen Filter; die Standards gelten, sobald er zurückgesetzt wird.'
			)
		).toBeVisible();
	}
};

const systemToneBox = (canvasElement: HTMLElement) =>
	within(
		canvasElement.querySelector<HTMLElement>(
			'[data-cy="notif-system-tone"]'
		)!
	);

/**
 * System notices have their own tone picker next to the system switch:
 * default ton-2, same play / volume controls as the rows in the dialog. The
 * choice lands in the notification settings.
 */
export const SystemTone: Story = {
	decorators: [
		withStoreState(() => notificationSettingsStore.resetForTests())
	],
	play: async ({ canvasElement }) => {
		const box = systemToneBox(canvasElement);
		const picker = box.getByRole('combobox', {
			name: 'Ton für Systemmeldungen'
		});
		await expect(picker).toHaveValue('ton-2');
		await expect(picker).toBeEnabled();

		await userEvent.selectOptions(picker, 'ton-5');
		await expect(
			notificationSettingsStore.getState().settings.systemTone.sound
		).toBe('ton-5');

		await userEvent.click(box.getByRole('button', { name: 'Lauter' }));
		await expect(
			notificationSettingsStore.getState().settings.systemTone.volume
		).toBe(0.75);
		await userEvent.click(box.getByRole('button', { name: 'Leiser' }));
		await userEvent.click(box.getByRole('button', { name: 'Leiser' }));
		await expect(
			notificationSettingsStore.getState().settings.systemTone.volume
		).toBe(0.25);

		await expect(
			box.getByRole('button', { name: 'Ton vorhören' })
		).toBeEnabled();
		// "No tone": nothing to preview, the muted icon replaces the button.
		await userEvent.selectOptions(picker, 'none');
		await expect(
			box.queryByRole('button', { name: 'Ton vorhören' })
		).toBeNull();
	}
};

/** A stored choice is shown, and the system switch gates the picker. */
export const SystemToneSwitchedOff: Story = {
	decorators: [
		withStoreState(() => {
			notificationSettingsStore.resetForTests();
			notificationSettingsStore.updateSettings({
				families: { system: false },
				systemTone: { sound: 'ton-9', volume: 0.25 }
			});
		})
	],
	play: async ({ canvasElement }) => {
		const box = systemToneBox(canvasElement);
		const picker = box.getByRole('combobox', {
			name: 'Ton für Systemmeldungen'
		});
		await expect(picker).toHaveValue('ton-9');
		await expect(picker).toBeDisabled();
		await expect(
			box.getByRole('button', { name: 'Lauter' })
		).toBeDisabled();
		await expect(
			box.getByRole('button', { name: 'Ton vorhören' })
		).toBeDisabled();
	}
};
