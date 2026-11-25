import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';
import { expectWaitingRoomLayout } from '../../app/registrationLoader/waitingRoomLayoutContract';
import { Stage } from '../../stage/stage';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { storyLegalLinks } from '../../waitingRoom/storyLegalLinks';
import { StaffCallJoinRoom, type StaffJoinPhase } from './StaffCallJoinRoom';

const body = () => within(document.body);

const meta = {
	title: 'DirectInvitation/Join as counsellor',
	component: StaffCallJoinRoom,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2356: a signed-in counsellor opens a Direkteinladung for an audio or video appointment. They join the call only, with their own account, also from another Träger; no sign-out, no guest account, and the conversation stays closed to them. With "Anklopfen" on they wait until the conversation\'s counsellor lets them in; with it off they are in at once. A counsellor already in the conversation is taken there instead. One room of the shared waiting-room frame (EntryRoomShell, shared bar).'
			}
		}
	},
	args: {
		phase: 'offer',
		medium: 'VIDEO',
		onJoin: fn(),
		onCancel: fn(),
		onOpenOwnSessions: fn()
	},
	decorators: [
		(Story) => (
			<GlobalComponentContext.Provider value={{ Stage }}>
				<LegalLinksContext.Provider value={storyLegalLinks}>
					<Story />
				</LegalLinksContext.Provider>
			</GlobalComponentContext.Provider>
		)
	]
} satisfies Meta<typeof StaffCallJoinRoom>;

export default meta;
type Story = StoryObj<typeof meta>;

const phaseStory = (
	phase: StaffJoinPhase,
	button: string,
	globals: Story['globals'] = desktop1440Globals
): Story => ({
	args: { phase },
	globals,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expect(body().getByTestId('staff-join-room')).toHaveAttribute(
			'data-phase',
			phase
		);
		await expect(body().getByTestId(button)).toBeVisible();
	}
});

export const Offer: Story = {
	name: 'Offer · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement, args }) => {
		await expectWaitingRoomLayout(canvasElement);
		await waitFor(() =>
			expect(
				body().getByRole('heading', {
					name: 'Als Berater:in beitreten'
				})
			).toBeVisible()
		);
		await userEvent.click(body().getByTestId('staff-join-button'));
		await expect(args.onJoin).toHaveBeenCalledTimes(1);
	}
};

export const OfferPhone: Story = {
	...phaseStory('offer', 'staff-join-button', phone390Globals),
	name: 'Offer · 390'
};

export const OfferAudioEnglish: Story = {
	name: 'Offer · audio · English',
	args: { medium: 'AUDIO' },
	globals: { ...desktop1440Globals, locale: 'en' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await waitFor(() =>
			expect(
				body().getByRole('heading', { name: 'Join as counsellor' })
			).toBeVisible()
		);
	}
};

export const Joining: Story = {
	...phaseStory('joining', 'staff-join-button'),
	name: 'Joining (request on its way)'
};

export const Waiting: Story = {
	name: 'Waiting to be let in · 1440',
	args: { phase: 'waiting' },
	globals: desktop1440Globals,
	play: async ({ canvasElement, args }) => {
		await expectWaitingRoomLayout(canvasElement);
		await waitFor(() =>
			expect(
				body().getByRole('heading', { name: 'Sie haben angeklopft' })
			).toBeVisible()
		);
		await userEvent.click(body().getByTestId('staff-join-cancel'));
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
	}
};

export const WaitingPhone: Story = {
	...phaseStory('waiting', 'staff-join-cancel', phone390Globals),
	name: 'Waiting to be let in · 390'
};

export const WaitingPhoneDark: Story = {
	...phaseStory('waiting', 'staff-join-cancel', {
		...phone390Globals,
		scheme: 'dark'
	}),
	name: 'Waiting to be let in · 390 · dark'
};

export const CallNotStarted: Story = {
	...phaseStory('notStarted', 'staff-join-cancel'),
	name: 'Call has not started'
};

export const Refused: Story = {
	...phaseStory('refused', 'staff-join-own-sessions'),
	name: 'Not let in'
};

export const Forbidden: Story = {
	...phaseStory('forbidden', 'staff-join-own-sessions'),
	name: 'Cannot join (removed, link inactive)'
};

export const Ended: Story = {
	...phaseStory('ended', 'staff-join-own-sessions'),
	name: 'Call ended'
};

export const Failed: Story = {
	...phaseStory('error', 'staff-join-button', phone390Globals),
	name: 'Joining failed · retry · 390'
};
