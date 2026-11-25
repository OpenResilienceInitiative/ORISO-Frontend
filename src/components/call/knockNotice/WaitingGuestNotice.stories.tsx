import * as React from 'react';
import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Box, Typography } from '@mui/material';
import { WaitingGuestNotice } from './WaitingGuestNoticeHost';
import {
	createFakeCallKnockTransport,
	FakeCallKnockTransport
} from './fakeCallKnockTransport';
import type { CallKnock } from './callKnockModel';
import type { WaitingConversation } from './waitingGuests';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';

const SESSION = 294;
const CONVERSATION: WaitingConversation = {
	sessionId: SESSION,
	roomId: '!sb-session:matrix.storybook.test',
	isVideo: true,
	path: `/sessions/consultant/sessionView/!sb-session:matrix.storybook.test/${SESSION}`
};

const knock = (secondsAgo: number): CallKnock => ({
	id: 86,
	sessionId: SESSION,
	displayName: 'giraffe_alva_3914',
	status: 'PENDING',
	medium: 'VIDEO',
	/* Relative to now, so the waiting time reads the same on every run. */
	requestedAt: new Date(Date.now() - secondsAgo * 1000).toISOString(),
	avatarId: 'giraffe'
});

const JUST_ARRIVED = [knock(20)];
const WAITING_LONGER = [knock(150)];

interface StoryProps {
	knocks: CallKnock[];
	onEnterCall: (conversation: WaitingConversation) => Promise<boolean>;
	playSound: () => void;
	onTransport?: (transport: FakeCallKnockTransport) => void;
}

/** The notice over a stand-in for any page of the app: no call is running. */
const WaitingGuestStory = ({
	knocks,
	onEnterCall,
	playSound,
	onTransport
}: StoryProps) => {
	const transport = useMemo(() => {
		const created = createFakeCallKnockTransport(knocks);
		onTransport?.(created);
		return created;
		// One transport per story render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return (
		<Box
			data-testid="page"
			sx={{
				minHeight: '100vh',
				backgroundColor: 'var(--m3-surface-container, #f3edec)',
				p: 3
			}}
		>
			<Typography component="h1" sx={{ fontSize: 24, m: 0 }}>
				Ihr Überblick
			</Typography>
			<WaitingGuestNotice
				conversations={[CONVERSATION]}
				onEnterCall={onEnterCall}
				transport={transport}
				playSound={playSound}
			/>
		</Box>
	);
};

const transports = new WeakMap<object, FakeCallKnockTransport>();

/**
 * P0 (Frank, 25 Nov 2026) — somebody came through an audio or video
 * Direkteinladung without a date and waits, but no call is running. The
 * counsellor sees who waits wherever she is in the app; one click starts the
 * call of that conversation and lets the person in.
 */
const meta = {
	title: 'Components/Call/Knock notice/Nobody in a call yet',
	component: WaitingGuestStory,
	tags: ['autodocs'],
	args: {
		knocks: JUST_ARRIVED,
		onEnterCall: fn(async () => true),
		playSound: fn()
	},
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Anklopfen, bevor ein Anruf läuft: Öffnet jemand eine Direkteinladung (Audio oder Video) ohne Termin, wartet die Person, und es gibt noch keinen Anruf, in dem die Beraterin sie einlassen könnte. Derselbe Hinweis „Wartende Personen“ erscheint deshalb unten rechts auf jeder Seite der App. „Anruf starten und einlassen“ öffnet das Gespräch, startet den Anruf und lässt die Person ein; „Ablehnen“ startet nichts. Sobald ein Anruf läuft, übernimmt der Hinweis im Anruf (Story „Knock notice“).'
			}
		}
	}
} satisfies Meta<typeof WaitingGuestStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Somebody just arrived: the notice sits in the corner of the page. */
export const SomebodyWaits: Story = {
	globals: desktop1440Globals,
	play: async ({ canvas }) => {
		const notice = await canvas.findByTestId('call-knock-notice');
		await expect(notice).toHaveAttribute('data-placement', 'page');
		await expect(
			within(notice).getByTestId('call-knock-name')
		).toHaveTextContent('giraffe_alva_3914');
		// The button says that it starts the call too.
		await expect(
			within(notice).getByTestId('call-knock-admit')
		).not.toHaveTextContent(/^Einlassen$/);
		const box = notice.getBoundingClientRect();
		await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
		await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
	}
};

/** Waiting for more than a minute: the waiting time is spelled out. */
export const WaitingForMinutes: Story = {
	globals: desktop1440Globals,
	args: { knocks: WAITING_LONGER }
};

/** On a phone the notice stays inside the screen, above the bottom bar. */
export const OnAPhone: Story = {
	globals: phone390Globals,
	play: async ({ canvas }) => {
		const box = (
			await canvas.findByTestId('call-knock-notice')
		).getBoundingClientRect();
		await expect(box.left).toBeGreaterThanOrEqual(0);
		await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
		await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
	}
};

/** One click: the call of that conversation starts and the person is let in. */
export const StartCallAndLetIn: Story = {
	globals: desktop1440Globals,
	args: {
		knocks: JUST_ARRIVED,
		onTransport: (transport) => transports.set(JUST_ARRIVED, transport)
	},
	play: async ({ args, canvas }) => {
		const notice = await canvas.findByTestId('call-knock-notice');
		await userEvent.click(within(notice).getByTestId('call-knock-admit'));
		await expect(args.onEnterCall).toHaveBeenCalledWith(CONVERSATION);
		await waitFor(() =>
			expect(canvas.queryByTestId('call-knock-notice')).toBeNull()
		);
		await expect(transports.get(JUST_ARRIVED)?.decisions).toEqual([
			'admit:86'
		]);
	}
};
