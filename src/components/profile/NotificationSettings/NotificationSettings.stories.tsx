import * as React from 'react';
import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotificationSettingsPanel } from './index';
import { APP_ORISO_FIGMA_URL } from '../../storybookDesignLinks';
import { notificationSettingsStore } from '../../../utils/notificationSettings/store';

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
