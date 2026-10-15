import * as React from 'react';
import { useLayoutEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, waitFor } from 'storybook/test';
import { Stage } from '../../stage/stage';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { useGroupJoinHandoverCopy } from '../../groupChat/groupJoinHandoverCopy';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';
import { HandoverStage } from './HandoverStage';
import { RegistrationHandover } from './RegistrationHandover';
import {
	HANDOVER_MILESTONES,
	markHandoverMilestone,
	resetHandoverProgress,
	useHandoverProgress
} from './handoverProgress';
import { expectWaitingRoomLayout } from './waitingRoomLayoutContract';

/**
 * The one waiting room between "Registrieren" and the message field (#1219).
 *
 * Every story renders the real `HandoverStage` — the frame both the
 * registration and the app mount — so what you see here is what stands on
 * both sides of the document load. Each story checks the layout contract
 * (`waitingRoomLayoutContract.ts`): stage beside the column, the shared bar at
 * the bottom edge, the button across the bar.
 */
const meta: Meta = {
	title: 'Entry flows/Waiting room/After Registrieren',
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<GlobalComponentContext.Provider value={{ Stage }}>
				{/* `#storybook-root` is not full height; the app root is. */}
				<Box sx={{ minHeight: '100vh' }}>
					<Story />
				</Box>
			</GlobalComponentContext.Provider>
		)
	]
};

export default meta;

/** Sets the real progress store to "the first `finished` milestones done". */
const Milestones = ({
	finished,
	children
}: {
	finished: number;
	children: React.ReactNode;
}) => {
	useLayoutEffect(() => {
		resetHandoverProgress();
		HANDOVER_MILESTONES.slice(0, finished).forEach(markHandoverMilestone);
		return () => resetHandoverProgress();
	}, [finished]);
	return <>{children}</>;
};

const Waiting = ({ finished }: { finished: number }) => (
	<Milestones finished={finished}>
		<HandoverStage>
			<RegistrationHandover
				ready={finished >= HANDOVER_MILESTONES.length}
				onEnter={() => undefined}
			/>
		</HandoverStage>
	</Milestones>
);

const expectFill = async (canvasElement: HTMLElement, fill: number) => {
	await waitFor(() =>
		expect(
			canvasElement.ownerDocument
				.querySelector('[data-cy="registration-handover"]')
				?.getAttribute('data-cy-progress')
		).toBe(String(fill))
	);
};

export const JustClicked: StoryObj = {
	name: '1 — Registrieren gedrückt (nichts fertig)',
	globals: desktop1440Globals,
	render: () => <Waiting finished={0} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectFill(canvasElement, 0);
	}
};

export const AtTheDocumentLoad: StoryObj = {
	name: '2 — Konto da, Seite lädt neu (3 von 7)',
	globals: desktop1440Globals,
	render: () => <Waiting finished={3} />,
	parameters: {
		docs: {
			description: {
				story: 'Der Moment des unsichtbaren Neuladens. Die App-Seite malt danach genau dieses Bild — gleicher Rahmen, gleicher Balken.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectFill(canvasElement, 43);
	}
};

export const AlmostThere: StoryObj = {
	name: '3 — Chat verbunden, Bildschirme laden (6 von 7)',
	globals: desktop1440Globals,
	render: () => <Waiting finished={6} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectFill(canvasElement, 86);
	}
};

export const Ready: StoryObj = {
	name: '4 — Alles geladen: Anfrage schreiben',
	globals: desktop1440Globals,
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectFill(canvasElement, 100);
		await expect(
			await canvas.findByRole('button', { name: /Anfrage schreiben/i })
		).toBeEnabled();
	}
};

export const ReadyPhone: StoryObj = {
	name: '4 — Alles geladen (Handy 390)',
	globals: phone390Globals,
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

export const PreparingPhone: StoryObj = {
	name: '2 — Seite lädt neu (Handy 390)',
	globals: phone390Globals,
	render: () => <Waiting finished={3} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

const GroupJoin = () => {
	const copy = useGroupJoinHandoverCopy();
	return (
		<Milestones finished={3}>
			<HandoverStage>
				<RegistrationHandover
					ready={false}
					forcedState="preparing"
					onEnter={() => undefined}
					copy={copy}
				/>
			</HandoverStage>
		</Milestones>
	);
};

export const GroupInvitation: StoryObj = {
	name: 'Gruppen-Einladung: derselbe Warteraum, eigene Worte',
	globals: desktop1440Globals,
	render: () => <GroupJoin />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

/**
 * The whole run, so the fill can be watched. The gaps between steps are
 * made up for the demo — in the app the bar moves only when a step is done.
 */
const Run = () => {
	const progress = useHandoverProgress();
	const [, setTick] = useState(0);
	useLayoutEffect(() => {
		resetHandoverProgress();
		const timers = HANDOVER_MILESTONES.map((milestone, i) =>
			window.setTimeout(
				() => {
					markHandoverMilestone(milestone);
					setTick((n) => n + 1);
				},
				900 * (i + 1)
			)
		);
		return () => {
			timers.forEach(window.clearTimeout);
			resetHandoverProgress();
		};
	}, []);
	return (
		<>
			<HandoverStage>
				<RegistrationHandover
					ready={progress >= 100}
					onEnter={() => undefined}
				/>
			</HandoverStage>
			<Typography
				sx={{
					position: 'fixed',
					top: 8,
					right: 8,
					zIndex: 99,
					px: 1,
					fontSize: 11,
					fontFamily: 'monospace',
					bgcolor: 'rgba(255,255,255,.9)'
				}}
			>
				Vorführung: Abstände erfunden, Schritte echt ({progress} %)
			</Typography>
		</>
	);
};

export const WholeRun: StoryObj = {
	name: 'Ablauf zum Zuschauen',
	globals: desktop1440Globals,
	render: () => <Run />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};
