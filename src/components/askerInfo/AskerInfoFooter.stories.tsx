import { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { AskerInfoFooter } from './AskerInfoFooter';
import { AskerInfoActionContext } from './askerInfoActionContext';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import './askerInfo.styles';

/**
 * The footer is driven entirely by `AskerInfoActionContext`, so both states can
 * be shown without a session: the wrapper just supplies the flag the allocation
 * select would otherwise set.
 */
const withPendingChange =
	(hasPendingChange: boolean) => (Story: React.ComponentType) => (
		<AskerInfoActionContext.Provider
			value={{ hasPendingChange, setHasPendingChange: () => undefined }}
		>
			<div className="askerInfo__wrapper" style={{ width: '100%' }}>
				<Story />
			</div>
		</AskerInfoActionContext.Provider>
	);

const meta = {
	title: 'REGISTRATION/AskerInfoFooter',
	component: AskerInfoFooter,
	tags: ['autodocs'],
	args: { onLeave: () => undefined },
	parameters: {
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'Client-profile footer ("Side Scroller Footer" in Figma): two 128x96 pills. ' +
					'Back is always active; next stays inert until the allocation changes, then turns primary.'
			}
		}
	}
} satisfies Meta<typeof AskerInfoFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing changed yet — next is inert and muted. */
export const NothingPending: Story = {
	decorators: [withPendingChange(false)]
};

/** A different consultant was picked — next becomes primary. */
export const PendingChange: Story = {
	decorators: [withPendingChange(true)]
};

/** 320px is the narrowest layout the issue asks for. */
export const NarrowViewport: Story = {
	decorators: [withPendingChange(true)],
	parameters: {
		viewport: { defaultViewport: 'mobile1' }
	}
};
