/**
 * FE#513 — the 1:1 header "+" (add-supervisor entry) never renders as a dead
 * decorative element: interactive when it can act, otherwise a disabled
 * button with an honest tooltip (house rule: disable, don't hide — including
 * for askers).
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatroomMainInteractionIcon } from './ChatroomMainInteractionIcon';
import './sessionHeader.styles.scss';

const meta: Meta<typeof ChatroomMainInteractionIcon> = {
	title: 'Components/Session/ChatroomMainInteractionIcon',
	component: ChatroomMainInteractionIcon,
	parameters: {
		docs: {
			description: {
				component:
					'Atomic room-header interaction from Figma 7608:40827. The 40 px pill combines an optional add action with exactly one 24 px conversation-state glyph.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof ChatroomMainInteractionIcon>;

export const ActiveConversation: Story = {
	name: 'Active Conversation',
	args: {
		type: 'active',
		showAddIcon: true,
		addLabel: 'Person hinzufügen',
		onAddClick: () => {}
	}
};

export const WaitingRoomWithAdd: Story = {
	name: 'Waiting Room + Add',
	args: {
		type: 'waiting',
		showAddIcon: true,
		addLabel: 'Person hinzufügen',
		onAddClick: () => {}
	}
};

export const InquiryWithAdd: Story = {
	name: 'Inquiry + Add',
	args: {
		type: 'inquiry',
		showAddIcon: true,
		addLabel: 'Person hinzufügen',
		onAddClick: () => {}
	}
};

export const WaitingRoom: Story = {
	name: 'Waiting Room',
	args: {
		type: 'waiting',
		showAddIcon: false
	}
};

export const Inquiry: Story = {
	name: 'Inquiry',
	args: {
		type: 'inquiry',
		showAddIcon: false
	}
};

export const DisabledAsker: Story = {
	name: 'Disabled — asker (grey out, never hide)',
	args: {
		type: 'nearby',
		showAddIcon: true,
		addLabel: 'Supervision wird vom Beratungsteam verwaltet'
	}
};

export const DisabledMobileConsultant: Story = {
	name: 'Disabled — consultant on mobile',
	args: {
		type: 'nearby',
		showAddIcon: true,
		addLabel: 'Supervisor hinzufügen – am Desktop verfügbar'
	}
};

export const DisabledSupervisionUnavailable: Story = {
	name: 'Disabled — supervision not enabled for this chat',
	args: {
		type: 'live',
		showAddIcon: true,
		addLabel: 'Supervisor hinzufügen – hier nicht verfügbar'
	}
};
