import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import {
	NotificationConfigDialog,
	NotificationConfigView
} from './NotificationConfigDialog';
import {
	DEFAULT_NOTIFICATION_CONFIG,
	NotificationArea,
	NotificationConfig
} from '../../../utils/notificationSettings/notificationConfig';
import type { SoundId } from '../../../utils/notificationSettings/model';
import { previewNotificationSound } from '../../../utils/notificationSettings/soundPlayback';
import { phone390Globals } from '../../message/messageStoryShell';
import './notificationConfigDialog.styles.scss';

const meta: Meta<typeof NotificationConfigDialog> = {
	title: 'Profile/NotificationConfigDialog',
	component: NotificationConfigDialog,
	parameters: { layout: 'fullscreen' }
};
export default meta;

/**
 * The whole dialog, end-to-end: M3Dialog chrome + hero icon + working
 * play buttons that actually play the vendored tones. Click a tone in a row,
 * then its play button — you hear the sound at the row's volume.
 */
const InteractiveDialog = () => {
	const [open, setOpen] = useState(true);
	const [config, setConfig] = useState<NotificationConfig>(
		DEFAULT_NOTIFICATION_CONFIG
	);
	return (
		<>
			{!open && (
				<button type="button" onClick={() => setOpen(true)}>
					Open notification settings
				</button>
			)}
			<NotificationConfigDialog
				open={open}
				config={config}
				onConfirm={(next) => {
					setConfig(next);
					setOpen(false);
				}}
				onClose={() => setOpen(false)}
			/>
		</>
	);
};

type DialogStory = StoryObj<typeof NotificationConfigDialog>;

export const Dialog: DialogStory = { render: () => <InteractiveDialog /> };

export const DialogMobile: DialogStory = {
	render: () => <InteractiveDialog />,
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		const documentBody = within(doc.body);
		const dialog = await waitFor(() => documentBody.getByRole('dialog'));
		const surface = dialog as HTMLElement;
		const body = dialog.querySelector('.m3Dialog__body') as HTMLElement;
		const footer = dialog.querySelector('.m3Dialog__footer') as HTMLElement;

		await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
		await expect(getComputedStyle(surface).overflowY).toBe('hidden');
		await expect(getComputedStyle(body).overflowY).toBe('auto');
		const soundSelect = body.querySelector<HTMLSelectElement>(
			'.notifConfig__select'
		)!;
		const soundSelectWrap = soundSelect.closest<HTMLElement>(
			'.notifConfig__selectWrap'
		)!;
		soundSelect.focus();
		await expect(getComputedStyle(soundSelectWrap).outlineStyle).toBe(
			'solid'
		);
		await expect(getComputedStyle(soundSelectWrap).outlineWidth).toBe(
			'2px'
		);
		body.scrollTop = body.scrollHeight;
		await expect(body.scrollTop).toBeGreaterThan(0);
		await expect(body.contains(footer)).toBe(false);
		await expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			doc.defaultView!.innerHeight
		);
		const confirm = within(footer).getByRole('button', {
			name: /Bestätigen|Confirm|profile\.notifications\.config\.confirm/
		});
		await waitFor(() => expect(confirm).toBeVisible());
	}
};

/**
 * The bare body (tabs + rows) without the dialog chrome — handy for isolating
 * layout. Preview here also plays real audio.
 */
const InteractiveBody = () => {
	const [config, setConfig] = useState<NotificationConfig>(
		DEFAULT_NOTIFICATION_CONFIG
	);
	const [area, setArea] = useState<NotificationArea>('requests');
	return (
		<div style={{ maxWidth: 560, padding: 16 }}>
			<NotificationConfigView
				config={config}
				activeArea={area}
				onAreaChange={setArea}
				onChange={(a, k, field, value) =>
					setConfig((prev) => ({
						...prev,
						[a]: {
							...prev[a],
							[k]: {
								...prev[a][k],
								[field]: value as SoundId | boolean | number
							}
						}
					}))
				}
				onPreview={previewNotificationSound}
			/>
		</div>
	);
};

type BodyStory = StoryObj<typeof NotificationConfigView>;

export const Body: BodyStory = { render: () => <InteractiveBody /> };
