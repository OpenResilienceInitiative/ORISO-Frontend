import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { SessionMenu } from './SessionMenu';

// MutableRefObject<boolean> required prop: a plain object literal with a
// mutable `current` field exactly matches the type the component expects.
const hasUserInitiatedStopOrLeaveRequest: React.MutableRefObject<boolean> = {
	current: false
};

const meta = {
	title: 'Organisms/SessionMenu',
	component: SessionMenu,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		// TODO: paste this component's Figma node URL (right-click the frame in
		// Figma -> "Copy link to selection") to show it in the story's Design tab.
		design: {
			type: 'figma',
			url: 'https://www.figma.com/design/REPLACE_FILE_KEY/ORISO?node-id=0-1'
		},
		docs: {
			description: {
				component:
					'Session header flyout menu with archive/delete, group-chat actions, legal links and (consultant) video/audio call buttons; behaviour is driven by the active session and user authorities.'
			}
		}
	}
} satisfies Meta<typeof SessionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	}
};

export const AnonymousMobileActions: Story = {
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: false,
		showMobileEndAnonymousChatAction: true,
		onMobileEndAnonymousChatAction: () => {},
		showMobileDeleteAnonymousAccountAction: true,
		onMobileDeleteAnonymousAccountAction: () => {}
	}
};
