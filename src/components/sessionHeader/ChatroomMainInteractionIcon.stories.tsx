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
	component: ChatroomMainInteractionIcon
};

export default meta;
type Story = StoryObj<typeof ChatroomMainInteractionIcon>;

export const InteractiveDesktopConsultant: Story = {
	name: 'Interactive (desktop consultant, supervision enabled)',
	args: {
		type: 'nearby',
		showAddIcon: true,
		addLabel: 'Supervisor verwalten',
		onAddClick: () => {}
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

export const NoAddAffordance: Story = {
	name: 'No add affordance (enquiry)',
	args: {
		type: 'nearby',
		showAddIcon: false
	}
};
