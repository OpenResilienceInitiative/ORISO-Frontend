import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SoundSettingsDialogView } from './SoundSettingsDialog';
import type { SoundId } from '../../../utils/notificationSettings/model';

const meta: Meta<typeof SoundSettingsDialogView> = {
	title: 'Profile/SoundSettingsDialog',
	component: SoundSettingsDialogView
};
export default meta;
type Story = StoryObj<typeof SoundSettingsDialogView>;

const InteractiveBody = () => {
	const [message, setMessage] = useState<SoundId>('chime');
	const [mention, setMention] = useState<SoundId>('default');
	return (
		<SoundSettingsDialogView
			messageSound={message}
			mentionSound={mention}
			onChange={(slot, id) =>
				slot === 'message' ? setMessage(id) : setMention(id)
			}
			onPreview={() => {}}
		/>
	);
};

export const Body: Story = { render: () => <InteractiveBody /> };
