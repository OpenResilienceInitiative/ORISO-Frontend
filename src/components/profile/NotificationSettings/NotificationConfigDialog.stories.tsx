import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
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
import './notificationConfigDialog.styles.scss';

const meta: Meta<typeof NotificationConfigDialog> = {
	title: 'Profile/NotificationConfigDialog',
	component: NotificationConfigDialog
};
export default meta;

/**
 * The whole dialog, end-to-end: OrisoDialog chrome + hero icon + working
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
	parameters: { viewport: { defaultViewport: 'mobile1' } }
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
