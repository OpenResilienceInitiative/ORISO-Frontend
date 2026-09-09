import { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SessionMenu } from './SessionMenu';
import { MenuVerticalIcon } from '../../resources/img/icons';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import './sessionMenu.styles.scss';

const hasUserInitiatedStopOrLeaveRequest = {
	current: false
};

const meta = {
	title: 'Organisms/SessionMenu',
	component: SessionMenu,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Session header flyout menu with archive/delete, group-chat actions, legal links and (consultant) video/audio call buttons. ' +
					'The trigger keeps the same size when opened, with a 2px `--m3-primary-container` highlight.'
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

/** Stable trigger geometry in closed and open states. */
function MenuTriggerShapeDemo() {
	const [expanded, setExpanded] = useState(false);
	return (
		<div
			style={{
				display: 'flex',
				gap: 24,
				alignItems: 'center',
				padding: 24,
				background: '#eae7e8'
			}}
		>
			<button
				type="button"
				className="sessionMenu__icon sessionMenu__icon--desktop"
				aria-expanded={false}
				aria-label="Menu closed"
				style={{ display: 'inline-flex' }}
			>
				<MenuVerticalIcon />
			</button>
			<button
				type="button"
				className="sessionMenu__icon sessionMenu__icon--desktop"
				aria-expanded={expanded}
				aria-label="Menu open toggle"
				style={{ display: 'inline-flex' }}
				onClick={() => setExpanded((v) => !v)}
			>
				<MenuVerticalIcon />
			</button>
			<span style={{ fontSize: 12, color: '#4C555F' }}>
				Stable 44×44 · click the right trigger to toggle its open state
			</span>
		</div>
	);
}

export const MenuTriggerShape: Story = {
	tags: ['autodocs'],
	args: {
		hasUserInitiatedStopOrLeaveRequest,
		isAskerInfoAvailable: true
	},
	render: () => <MenuTriggerShapeDemo />
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
