import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotificationConfigView } from './NotificationConfigDialog';
import {
	DEFAULT_NOTIFICATION_CONFIG,
	NotificationArea,
	NotificationConfig
} from '../../../utils/notificationSettings/notificationConfig';
import type { SoundId } from '../../../utils/notificationSettings/model';
import './notificationConfigDialog.styles.scss';

const meta: Meta<typeof NotificationConfigView> = {
	title: 'Profile/NotificationConfigDialog',
	component: NotificationConfigView
};
export default meta;
type Story = StoryObj<typeof NotificationConfigView>;

const Interactive = () => {
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
								[field]: value as SoundId | boolean
							}
						}
					}))
				}
				onPreview={() => {}}
			/>
		</div>
	);
};

export const Desktop: Story = { render: () => <Interactive /> };

export const Mobile: Story = {
	render: () => <Interactive />,
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};
