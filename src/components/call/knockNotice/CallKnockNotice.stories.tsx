import * as React from 'react';
import { useMemo } from 'react';
import i18n from 'i18next';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Box } from '@mui/material';
import { CallKnockNoticeHost } from './CallKnockNoticeHost';
import {
	createFakeCallKnockTransport,
	FakeCallKnockTransport
} from './fakeCallKnockTransport';
import type { CallKnock } from './callKnockModel';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';

const knock = (id: number, sessionId: number): CallKnock => ({
	id,
	sessionId,
	status: 'PENDING',
	medium: 'VIDEO',
	requestedAt: '2026-10-28T10:00:00Z'
});

/** User-IDs as the session list shows them — never a legal name. */
const NAMES: Record<number, string> = {
	501: 'sonnenblume-27',
	502: 'kiefer-08',
	503: 'lavendel-13'
};

const ONE = [knock(1, 501)];
const THREE = [knock(1, 501), knock(2, 502), knock(3, 503)];

interface KnockStoryProps {
	knocks: CallKnock[];
	minimised?: boolean;
	playSound: () => void;
	/** Lets a play function reach the fake to assert the decisions. */
	onTransport?: (transport: FakeCallKnockTransport) => void;
}

const resolveName = async (sessionId: number) => NAMES[sessionId] ?? null;

/**
 * The notice in a stand-in for the call stage: the real call widget needs
 * Matrix and Element Call, which the knock notice does not care about.
 */
const KnockStory = ({
	knocks,
	minimised = false,
	playSound,
	onTransport
}: KnockStoryProps) => {
	const transport = useMemo(() => {
		const created = createFakeCallKnockTransport(knocks);
		onTransport?.(created);
		return created;
		// One transport per story render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const host = (
		<CallKnockNoticeHost
			minimised={minimised}
			transport={transport}
			resolveName={resolveName}
			playSound={playSound}
		/>
	);
	return (
		<Box
			sx={{
				minHeight: '100vh',
				backgroundColor: 'var(--m3-surface-container, #f3edec)',
				p: minimised ? 0 : 3
			}}
		>
			<Box
				data-testid="call-stage"
				sx={
					minimised
						? {
								position: 'fixed',
								right: 12,
								bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
								width: 'min(220px, 44vw)',
								height: 'min(170px, 32vh)',
								borderRadius: '14px',
								backgroundColor: '#000',
								overflow: 'hidden'
							}
						: {
								position: 'relative',
								width: 'min(720px, 100%)',
								height: 420,
								borderRadius: '16px',
								backgroundColor: '#000',
								overflow: 'hidden',
								mx: 'auto'
							}
				}
			>
				{host}
			</Box>
		</Box>
	);
};

const transports = new WeakMap<object, FakeCallKnockTransport>();

/**
 * ORISO-Frontend#1892 — the counsellor is in a call and somebody knocks
 * through her audio or video direct link (ADR-029 §2). The notice sits inside
 * the call, so she can let the person in without leaving it.
 */
const meta = {
	title: 'Components/Call/Knock notice',
	component: KnockStory,
	tags: ['autodocs'],
	args: {
		knocks: ONE,
		playSound: fn()
	},
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Anklopfen im Anruf (#1892): Die Beraterin sieht im laufenden Anruf, wer anklopft, und entscheidet mit einem Klick — „Einlassen“ oder „Ablehnen“. Bei mehreren Wartenden blättert sie zwischen ihnen und kann „Alle einlassen“. Jeder neue Anklopfende spielt einen kurzen Ton. Ist der Anruf minimiert, sitzt der Hinweis direkt über dem kleinen Anruf. Die Bühne hier ist ein Platzhalter für den echten Anruf.'
			}
		}
	}
} satisfies Meta<typeof KnockStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One person is knocking: name, "Einlassen" and "Ablehnen", one chime. */
export const OnePersonKnocking: Story = {
	globals: desktop1440Globals,
	args: { knocks: ONE },
	play: async ({ args, canvas }) => {
		const notice = await canvas.findByTestId('call-knock-notice');
		await waitFor(() =>
			expect(
				within(notice).getByTestId('call-knock-name')
			).toHaveTextContent('sonnenblume-27')
		);
		await expect(args.playSound).toHaveBeenCalledTimes(1);
		await expect(
			within(notice).getByRole('button', {
				name: i18n.t('calls.knock.admit')
			})
		).toBeVisible();
		await expect(
			within(notice).getByRole('button', {
				name: i18n.t('calls.knock.decline')
			})
		).toBeVisible();
		await expect(
			within(notice).queryByTestId('call-knock-admit-all')
		).toBeNull();
		await expect(
			within(notice).queryByTestId('call-knock-next')
		).toBeNull();
	}
};

/** Three people are waiting: paging between them and "Alle einlassen". */
export const SeveralPeopleKnocking: Story = {
	globals: desktop1440Globals,
	args: { knocks: THREE },
	play: async ({ args, canvas }) => {
		const notice = await canvas.findByTestId('call-knock-notice');
		await expect(
			within(notice).getByTestId('call-knock-position')
		).toHaveTextContent(
			i18n.t('calls.knock.position', { current: 1, total: 3 })
		);
		await waitFor(() =>
			expect(
				within(notice).getByTestId('call-knock-name')
			).toHaveTextContent('sonnenblume-27')
		);
		await expect(args.playSound).toHaveBeenCalledTimes(1);
		await expect(
			within(notice).getByTestId('call-knock-admit-all')
		).toBeVisible();
		await expect(
			within(notice).getByTestId('call-knock-next')
		).toBeVisible();
	}
};

const MINIMISED = [knock(1, 501), knock(2, 502)];

/**
 * The call is minimised (the small view on a phone): the notice docks just
 * above the small call instead of being clipped by it.
 */
export const MinimisedCall: Story = {
	globals: phone390Globals,
	args: { knocks: MINIMISED, minimised: true },
	play: async ({ canvasElement }) => {
		// Portalled to the page, outside the story root.
		const page = within(canvasElement.ownerDocument.body);
		const notice = await page.findByTestId('call-knock-notice');
		await expect(notice).toHaveAttribute('data-placement', 'docked');
		const stage = page.getByTestId('call-stage').getBoundingClientRect();
		const box = notice.getBoundingClientRect();
		await expect(box.bottom).toBeLessThanOrEqual(stage.top);
		await expect(box.left).toBeGreaterThanOrEqual(0);
		await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
	}
};

/** One click lets the person in; the notice goes away. */
export const LetInWithOneClick: Story = {
	globals: desktop1440Globals,
	args: {
		knocks: ONE,
		onTransport: (transport) => transports.set(ONE, transport)
	},
	play: async ({ canvas }) => {
		const notice = await canvas.findByTestId('call-knock-notice');
		await userEvent.click(within(notice).getByTestId('call-knock-admit'));
		await waitFor(() =>
			expect(canvas.queryByTestId('call-knock-notice')).toBeNull()
		);
		await expect(transports.get(ONE)?.decisions).toEqual(['admit:1']);
	}
};

/**
 * Keyboard only: page to the second person, turn them down, let the others
 * in at once.
 */
export const DecideFromTheKeyboard: Story = {
	globals: desktop1440Globals,
	args: {
		knocks: THREE,
		onTransport: (transport) => transports.set(THREE, transport)
	},
	play: async ({ canvas }) => {
		const notice = await canvas.findByTestId('call-knock-notice');
		const position = () =>
			within(notice).getByTestId('call-knock-position');
		const name = () => within(notice).getByTestId('call-knock-name');

		within(notice).getByTestId('call-knock-next').focus();
		await userEvent.keyboard('{Enter}');
		await expect(position()).toHaveTextContent(
			i18n.t('calls.knock.position', { current: 2, total: 3 })
		);
		await waitFor(() => expect(name()).toHaveTextContent('kiefer-08'));

		await userEvent.tab();
		await expect(
			within(notice).getByTestId('call-knock-admit-all')
		).toHaveFocus();
		await userEvent.tab();
		await expect(
			within(notice).getByTestId('call-knock-decline')
		).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(position()).toHaveTextContent(
				i18n.t('calls.knock.position', { current: 2, total: 2 })
			)
		);
		await expect(name()).toHaveTextContent('lavendel-13');

		within(notice).getByTestId('call-knock-admit-all').focus();
		await userEvent.keyboard(' ');
		await waitFor(() =>
			expect(canvas.queryByTestId('call-knock-notice')).toBeNull()
		);
		await expect(transports.get(THREE)?.decisions).toEqual([
			'decline:2',
			'admit-all'
		]);
	}
};
