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
					'#597: trigger is horizontal 48×32 when closed and vertical 32×48 with 2px `--m3-primary-container` when `aria-expanded`.'
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

/** Isolated #597 trigger shape (closed vs open) without full session providers. */
export const MenuTriggerShape: Story = {
	tags: ['autodocs'],
	render: () => {
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
					Closed 48×32 · click right for open 32×48
				</span>
			</div>
		);
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
