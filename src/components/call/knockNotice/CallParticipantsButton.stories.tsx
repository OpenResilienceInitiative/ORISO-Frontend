import * as React from 'react';
import { useMemo } from 'react';
import i18n from 'i18next';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Box } from '@mui/material';
import { CallParticipantsButton } from './CallParticipantsButton';
import { CallKnockNoticeHost } from './CallKnockNoticeHost';
import { createFakeCallKnockTransport } from './fakeCallKnockTransport';
import { useCallKnocks } from './useCallKnocks';
import type { CallKnock } from './callKnockModel';
import { desktop1440Globals } from '../../message/messageStoryShell';

const knock = (id: number): CallKnock => ({
	id,
	sessionId: 500 + id,
	status: 'PENDING',
	medium: 'VIDEO',
	requestedAt: '2026-10-28T10:00:00Z'
});

const NAMES: Record<number, string> = {
	501: 'sonnenblume-27',
	502: 'kiefer-08',
	503: 'lavendel-13'
};
const resolveName = async (sessionId: number) => NAMES[sessionId] ?? null;

interface ToolbarStoryProps {
	knocks: CallKnock[];
	playSound: () => void;
}

/**
 * One poll feeds both the notice and the toolbar count: the host gets the
 * knocks it would otherwise fetch itself.
 */
const ToolbarStory = ({ knocks, playSound }: ToolbarStoryProps) => {
	const transport = useMemo(() => createFakeCallKnockTransport(knocks), []); // eslint-disable-line react-hooks/exhaustive-deps
	const state = useCallKnocks({
		enabled: true,
		transport,
		resolveName,
		playSound
	});
	return (
		<Box
			sx={{
				minHeight: '100vh',
				p: 3,
				backgroundColor: 'var(--m3-surface-container, #f3edec)'
			}}
		>
			<Box
				sx={{
					position: 'relative',
					width: 'min(720px, 100%)',
					height: 420,
					mx: 'auto',
					borderRadius: '16px',
					backgroundColor: '#000',
					overflow: 'hidden'
				}}
			>
				<CallKnockNoticeHost knocks={state} />
				<Box
					role="toolbar"
					aria-label={i18n.t('calls.group.iframeTitle')}
					sx={{
						position: 'absolute',
						bottom: 16,
						left: '50%',
						transform: 'translateX(-50%)',
						display: 'flex',
						gap: 1,
						px: 1,
						borderRadius: '28px',
						backgroundColor: 'var(--m3-surface, #fff8f7)'
					}}
				>
					<CallParticipantsButton waiting={state.people.length} />
				</Box>
			</Box>
		</Box>
	);
};

/**
 * #1892 scope extension (Frank, 28 Oct), FE#1794 §3: a small count on the
 * participants icon of the call toolbar shows how many people are knocking.
 * The toolbar here is a stand-in: the real one lives inside Element Call.
 */
const meta = {
	title: 'Components/Call/Knock waiting count',
	component: ToolbarStory,
	tags: ['autodocs'],
	args: { knocks: [knock(1), knock(2), knock(3)], playSound: fn() },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Zahl der Wartenden am Teilnehmenden-Symbol der Anrufleiste (#1892, #1794 §3). Dieselbe Abfrage wie der Anklopf-Hinweis. Die Leiste hier ist ein Platzhalter; die echte Leiste liegt in Element Call.'
			}
		}
	}
} satisfies Meta<typeof ToolbarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three people knocking: the badge says 3, and so does the button's name. */
export const ThreeWaiting: Story = {
	globals: desktop1440Globals,
	play: async ({ canvas }) => {
		const button = await canvas.findByTestId('call-participants-button');
		await waitFor(() =>
			expect(button).toHaveAccessibleName(
				i18n.t('calls.knock.participantsWaiting', { count: 3 })
			)
		);
		await expect(
			within(button).getByTestId('call-participants-badge')
		).toHaveTextContent('3');
	}
};

/** Letting one person in lowers the count; nobody waiting hides the badge. */
export const CountFollowsTheNotice: Story = {
	globals: desktop1440Globals,
	args: { knocks: [knock(1), knock(2)] },
	play: async ({ canvas }) => {
		const button = await canvas.findByTestId('call-participants-button');
		const notice = await canvas.findByTestId('call-knock-notice');
		await userEvent.click(within(notice).getByTestId('call-knock-admit'));
		await waitFor(() =>
			expect(button).toHaveAccessibleName(
				i18n.t('calls.knock.participantsWaiting', { count: 1 })
			)
		);
		await userEvent.click(
			within(canvas.getByTestId('call-knock-notice')).getByTestId(
				'call-knock-decline'
			)
		);
		await waitFor(() =>
			expect(button).toHaveAccessibleName(
				i18n.t('calls.knock.participants')
			)
		);
		await expect(
			button.querySelector('.MuiBadge-invisible')
		).not.toBeNull();
	}
};
