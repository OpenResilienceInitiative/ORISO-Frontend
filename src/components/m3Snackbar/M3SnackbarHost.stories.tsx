import * as React from 'react';
import { useEffect, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Box, Typography } from '@mui/material';
import { M3Snackbar } from './M3Snackbar';
import { M3SnackbarHost } from './M3SnackbarHost';
import { createSnackbarStack, SnackbarStackEntryInput } from './snackbarStack';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';

/** A plain M3 snackbar as a stack entry. */
const plain = (
	message: string,
	extra: Partial<SnackbarStackEntryInput> = {}
): SnackbarStackEntryInput => ({
	announcement: message,
	render: ({ dismiss }) => (
		<M3Snackbar
			placement="inline"
			role="status"
			message={message}
			onClose={dismiss}
			closeLabel="Schließen"
			sx={{ maxWidth: 'none' }}
		/>
	),
	...extra
});

const Demo = ({
	entries,
	maxVisible
}: {
	entries: SnackbarStackEntryInput[];
	maxVisible?: number;
}) => {
	const stack = useMemo(() => createSnackbarStack(), []);
	useEffect(() => {
		entries.forEach((entry) => stack.enqueue(entry));
		return () => stack.clear();
		// Seeded once per story render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stack]);
	return (
		<Box
			sx={{
				minHeight: '100vh',
				p: 3,
				backgroundColor: 'var(--m3-surface-container)',
				color: 'var(--m3-on-surface)'
			}}
		>
			<Typography
				component="h1"
				sx={{ fontSize: 22, lineHeight: '28px' }}
			>
				Seite hinter dem Stapel
			</Typography>
			<M3SnackbarHost stack={stack} maxVisible={maxVisible} />
		</Box>
	);
};

const items = () => screen().getAllByTestId('m3-snackbar-host-item');
const screen = () => within(document.body);

const meta = {
	title: 'Molecules/M3Snackbar/Stack',
	component: M3SnackbarHost,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Der app-weite Snackbar-Stapel (#1499). Mehrere Snackbars gleichzeitig — etwa wenn mehrere Kolleg:innen an einen Gesprächskreis klopfen. **Reihenfolge:** die neueste sitzt dort, wo M3 die einzelne Snackbar hinlegt (unten), ältere rücken darüber; gelesen wird von alt nach neu, also wer zuerst geklopft hat, zuerst. **Zu viele:** über `maxVisible` (Desktop 3, Handy 2) klappen die ÄLTESTEN in „+N weitere anzeigen" zusammen — die neueste verschwindet nie. **Zeit:** getimte Einträge pausieren, solange Maus oder Fokus auf dem Stapel liegen; Einträge, die auf eine Entscheidung warten, bleiben, und Escape schließt sie nicht. **Barrierefreiheit:** benannte Landmarke, Ankünfte einmal höflich angesagt, kein Fokusraub, ohne Animation bei reduzierter Bewegung. **Ort:** Desktop unten links über der Listenspalte (nie über dem Eingabefeld), Handy volle Breite über der Navigationsleiste. Der stehende Wiederherstellungs-Hinweis (`KeyBackupRecoveryPrompt`, `yieldToOthers`) weicht, solange der Stapel etwas zeigt.'
			}
		}
	}
} satisfies Meta<typeof M3SnackbarHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three at once: oldest on top, newest at the bottom edge. */
export const ThreeStacked: Story = {
	name: 'Three stacked · 1440',
	globals: desktop1440Globals,
	render: () => (
		<Demo
			entries={[
				plain('Anna Berg ist jetzt im Gesprächskreis.'),
				plain('Entwurf gespeichert.'),
				plain('Anfrage von Mira Sommer abgelehnt.')
			]}
		/>
	),
	play: async () => {
		await waitFor(() => expect(items()).toHaveLength(3));
		await expect(items().map((item) => item.textContent)).toEqual([
			'Anna Berg ist jetzt im Gesprächskreis.',
			'Entwurf gespeichert.',
			'Anfrage von Mira Sommer abgelehnt.'
		]);
		const rects = items().map((item) => item.getBoundingClientRect());
		await expect(rects[0].top).toBeLessThan(rects[2].top);
		await expect(
			screen().getByRole('region', { name: 'Benachrichtigungen' })
		).toBeVisible();
	}
};

/** Five with room for three: the two oldest fold into "+2 weitere anzeigen". */
export const OverflowCollapsed: Story = {
	name: 'Overflow "+N" · 1440',
	globals: desktop1440Globals,
	render: () => (
		<Demo
			maxVisible={3}
			entries={['Eins', 'Zwei', 'Drei', 'Vier', 'Fünf'].map((text) =>
				plain(`Hinweis ${text}`)
			)}
		/>
	),
	play: async () => {
		await waitFor(() => expect(items()).toHaveLength(3));
		await expect(items()[0].textContent).toBe('Hinweis Drei');
		const more = screen().getByRole('button', {
			name: '2 weitere anzeigen'
		});
		await expect(more).toHaveAttribute('aria-expanded', 'false');

		await userEvent.click(more);
		await expect(items()).toHaveLength(5);
		await userEvent.click(
			screen().getByRole('button', { name: 'Weniger anzeigen' })
		);
		await expect(items()).toHaveLength(3);
	}
};

/** A timed note leaves on its own; the persistent one stays. */
export const TimedAndPersistent: Story = {
	name: 'Timed vs persistent · 1440',
	globals: desktop1440Globals,
	render: () => (
		<Demo
			entries={[
				plain('Bleibt, bis jemand entscheidet.', {
					dismissible: false
				}),
				plain('Geht nach 1,5 Sekunden.', { autoHideDuration: 1500 })
			]}
		/>
	),
	play: async () => {
		await waitFor(() => expect(items()).toHaveLength(2));
		await waitFor(() => expect(items()).toHaveLength(1), {
			timeout: 5000
		});
		await expect(items()[0].textContent).toBe(
			'Bleibt, bis jemand entscheidet.'
		);
	}
};

/** Escape closes what may be closed — never an open decision. */
export const EscapeKey: Story = {
	name: 'Keyboard: Escape · 1440',
	globals: desktop1440Globals,
	render: () => (
		<Demo
			entries={[
				{
					announcement: 'Wartet auf eine Entscheidung.',
					dismissible: false,
					render: () => (
						<M3Snackbar
							placement="inline"
							role="status"
							message="Wartet auf eine Entscheidung."
							action={{ label: 'Öffnen' }}
							sx={{ maxWidth: 'none' }}
						/>
					)
				},
				plain('Darf weg.')
			]}
		/>
	),
	play: async () => {
		await waitFor(() => expect(items()).toHaveLength(2));
		screen().getByRole('button', { name: 'Öffnen' }).focus();
		await userEvent.keyboard('{Escape}');
		await expect(items()).toHaveLength(2);

		screen().getByRole('button', { name: 'Schließen' }).focus();
		await userEvent.keyboard('{Escape}');
		await expect(items()).toHaveLength(1);
		await expect(items()[0]).toHaveTextContent(
			'Wartet auf eine Entscheidung.'
		);
	}
};

/** Phone: full width, two visible, above where the navigation bar sits. */
export const Phone390: Story = {
	name: 'Phone · 390',
	globals: phone390Globals,
	render: () => (
		<Demo
			entries={[
				plain('Hinweis Eins'),
				plain('Hinweis Zwei'),
				plain('Hinweis Drei')
			]}
		/>
	),
	play: async () => {
		await waitFor(() => expect(items()).toHaveLength(2));
		// Measured once the 200 ms entry slide has settled.
		await waitFor(() => {
			const newest = items()[items().length - 1].getBoundingClientRect();
			expect(window.innerHeight - newest.bottom).toBeGreaterThanOrEqual(
				88
			);
		});
		await expect(
			screen().getByRole('button', { name: '1 weitere anzeigen' })
		).toBeVisible();
	}
};
