import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { CaseHandoverReadOnlyNotice } from './CaseHandoverReadOnlyNotice';
import './session.styles.scss';

const meta: Meta<typeof CaseHandoverReadOnlyNotice> = {
	title: 'Organisms/CaseHandover/CaseHandoverReadOnlyNotice',
	component: CaseHandoverReadOnlyNotice,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Takes the composer\'s place for a colleague with **co-access** ("advice needed" handover): they can read the case until the grant expires, but never write to the advice seeker. `expiresAt` is naive UTC from the server and shown in local time.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithExpiry: Story = {
	args: { expiresAt: '2026-09-25T07:36:21' },
	play: async ({ canvasElement }) => {
		const notice = within(canvasElement).getByRole('status');
		await expect(notice.textContent).toMatch(/\d{2}:\d{2}/);
	}
};

/** A legacy grant without a stored expiry. */
export const WithoutExpiry: Story = {};
