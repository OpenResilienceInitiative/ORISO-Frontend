import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { TimelineSettings } from './TimelineSettings';
import {
	TIMELINE_SETTINGS_EVENT_TYPE,
	timelineSettingsStore
} from '../../utils/timelineSettings/store';

/** A Matrix client that has synced and keeps account data in memory. */
const storyClient = () => {
	const accountData = new Map<string, unknown>();
	return {
		getUserId: () => '@storybook:oriso.test',
		getSyncState: () => 'PREPARED',
		getAccountData: (type: string) =>
			accountData.has(type)
				? { getContent: () => accountData.get(type) }
				: undefined,
		setAccountData: (type: string, content: unknown) => {
			accountData.set(type, content);
			return Promise.resolve({});
		},
		on: () => {},
		removeListener: () => {},
		stored: () => accountData.get(TIMELINE_SETTINGS_EVENT_TYPE)
	};
};

const meta = {
	title: 'Profile/Anzeige/Timeline settings',
	component: TimelineSettings,
	// Before render: attaching notifies subscribers, which must not happen mid-render.
	beforeEach: () => {
		timelineSettingsStore.resetForTests();
		timelineSettingsStore.attachClient(storyClient() as any);
		return () => timelineSettingsStore.resetForTests();
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 480, padding: 16 }}>
				<Story />
			</div>
		)
	],
	parameters: {
		docs: {
			description: {
				component:
					'ADR-021 — "Anzeige" section for the appointments in the conversation list. ' +
					'Stored in Matrix account data (`org.oriso.timeline_settings`).'
			}
		}
	}
} satisfies Meta<typeof TimelineSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaults: Story = {
	name: 'Defaults — two areas, nothing opens, date at the tag',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByLabelText(/Zwei Bereiche/)).toBeChecked();
		await expect(canvas.getByLabelText('Nichts')).toBeChecked();
		await expect(canvas.getByLabelText('Am Themen-Fähnchen')).toBeChecked();
	}
};

export const ChangeIsStored: Story = {
	name: 'A choice is stored for every device',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByLabelText(/Eine Zeitleiste/));
		await userEvent.click(canvas.getByLabelText('Den nächsten Termin'));
		await waitFor(() =>
			expect(timelineSettingsStore.getState().settings).toMatchObject({
				scrollModel: 'single',
				reveal: 'next'
			})
		);
		await expect(canvas.getByLabelText(/Eine Zeitleiste/)).toBeChecked();
	}
};
