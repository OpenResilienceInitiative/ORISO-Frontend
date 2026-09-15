import * as React from 'react';
import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotificationSettingsPanel } from './index';
import { APP_ORISO_FIGMA_URL } from '../../storybookDesignLinks';
import { notificationSettingsStore } from '../../../utils/notificationSettings/store';
import { expect, within } from 'storybook/test';
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
			useEffect(() => {
				return () => notificationSettingsStore.resetForTests();
			}, []);
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
			canvas.getByRole('checkbox', { name: 'Anzeigen: System' })
		).toHaveAttribute('aria-checked', 'mixed');
		await expect(
			canvas.getByRole('checkbox', { name: 'Pille: Entwürfe' })
		).not.toBeChecked();
		await expect(
			canvas.getByText(
				'Diese Liste nutzt gerade einen eigenen Filter; die Standards gelten, sobald er zurückgesetzt wird.'
			)
		).toBeVisible();
	}
};
