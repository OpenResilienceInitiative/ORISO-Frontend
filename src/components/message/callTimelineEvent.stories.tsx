import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CallTimelineSystemMessage } from './CallTimelineSystemMessage';
import {
	desktop1440Globals,
	phone375Globals,
	tablet834Globals
} from './messageStoryShell';
import './message.styles.scss';

/**
 * The call event in the room timeline — ORISO-Frontend#780.
 *
 * Why this exists as an approval surface rather than a screenshot of the app:
 * the renderer is finished and fully wired, but **nothing ever sends a
 * `VIDEOCALL` alias message**, so neither state has ever appeared on screen.
 * `ALIAS_MESSAGE_TYPES.VIDEOCALL` has zero producers — only the enum definition
 * and three read sites. `isVideoActive` is computed correctly in
 * `sessionHelpers.ts` and flows into every message; it simply never meets a
 * message of that type.
 *
 * Modelling the four states here makes the required data shape visible, which
 * is what `ORISO-UserService#730` ("Emit call.* event notifications") has to
 * deliver. Frank, 2026-09-03: one entry that changes state, not two entries
 * that alternate — while the call runs it carries the button, afterwards the
 * same entry becomes the line in the log.
 */
const meta: Meta = {
	title: 'Chat/Call event in the timeline',
	parameters: {
		docs: {
			description: {
				component:
					'Das Anruf-Ereignis im Chatverlauf, in vier Zuständen: gesendet und empfangen, jeweils laufend und beendet. Nichts davon erscheint heute in der App — es fehlt der Absender, nicht der Empfänger. Abnahmefläche zu ORISO-Frontend#780.'
			}
		}
	}
};

export default meta;

const onJoin = fn();

/**
 * Sent and received are the same component in different alignment.
 *
 * Frank, 2026-09-04: "einmal unten links, einmal oben rechts … wir haben ja
 * gesendet und empfangen." The chat already distinguishes the two everywhere
 * else; the call event has to follow the same rule, otherwise the person cannot
 * tell at a glance whether they started the call or someone else did.
 */
const Bubble = ({
	side,
	label,
	children
}: {
	side: 'sent' | 'received';
	label: string;
	children: React.ReactNode;
}) => (
	<Box sx={{ mb: 3 }}>
		<Typography
			sx={{
				fontSize: 11,
				letterSpacing: '.08em',
				textTransform: 'uppercase',
				color: 'var(--m3-on-surface-variant, #444748)',
				mb: 0.75,
				textAlign: side === 'sent' ? 'right' : 'left'
			}}
		>
			{label}
		</Typography>
		<Box
			sx={{
				display: 'flex',
				justifyContent: side === 'sent' ? 'flex-end' : 'flex-start'
			}}
		>
			{/* The bubble has to shrink-wrap its content, otherwise it fills the
			    row and `justifyContent` has nothing left to push around — the
			    sent/received alignment would be invisible on a phone. */}
			<Box sx={{ maxWidth: 540, width: 'fit-content' }}>{children}</Box>
		</Box>
	</Box>
);

const Timeline = ({ children }: { children: React.ReactNode }) => (
	<Box
		sx={{
			p: { xs: 2, sm: 3 },
			bgcolor: 'var(--m3-surface-container-lowest, #ffffff)',
			minHeight: '100vh'
		}}
	>
		<Box sx={{ maxWidth: 760, mx: 'auto' }}>{children}</Box>
	</Box>
);

export const AllFourStates: StoryObj = {
	name: 'Alle vier Zustände',
	render: () => (
		<Timeline>
			<Bubble side="sent" label="Ich habe den Anruf gestartet · läuft">
				<CallTimelineSystemMessage
					state="running"
					headline="Du hast einen Videoanruf gestartet"
					statusLabel="Läuft"
					description="Die anderen Teilnehmenden können dem Videoanruf jetzt beitreten."
					actionLabel="Zum Videoanruf"
					onAction={onJoin}
				/>
			</Bubble>
			<Bubble side="received" label="Jemand anderes · läuft">
				<CallTimelineSystemMessage
					state="running"
					headline="Beraterin Carimat hat einen Videoanruf gestartet"
					statusLabel="Läuft"
					description="Sie können jetzt an der Videokonferenz teilnehmen."
					actionLabel="Beitreten"
					onAction={onJoin}
				/>
			</Bubble>
			<Bubble side="sent" label="Ich habe den Anruf gestartet · beendet">
				<CallTimelineSystemMessage
					state="ended"
					headline="Du hast den Videoanruf beendet"
					statusLabel="Beendet"
					durationLabel="Dauer 29 Min."
					description="Der Videoanruf ist beendet."
				/>
			</Bubble>
			<Bubble side="received" label="Jemand anderes · beendet">
				<CallTimelineSystemMessage
					state="ended"
					headline="Beraterin Carimat hat den Videoanruf beendet"
					statusLabel="Beendet"
					durationLabel="Dauer 29 Min."
					description="Der Videoanruf ist beendet."
				/>
			</Bubble>
		</Timeline>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Die vier Zustände untereinander. Sichtbar wird dabei die eigentliche Anforderung: laufend trägt der Eintrag den Beitreten-Knopf, beendet wird derselbe Eintrag zur Protokollzeile mit Dauer. Was heute fehlt, ist die Ausrichtung links/rechts — die Komponente kennt gesendet und empfangen nicht.'
			}
		}
	}
};

export const RunningJoinable: StoryObj = {
	name: 'Läuft — mit Beitreten',
	render: () => (
		<Timeline>
			<Bubble side="received" label="Jemand anderes · läuft">
				<CallTimelineSystemMessage
					state="running"
					headline="Beraterin Carimat hat einen Videoanruf gestartet"
					statusLabel="Läuft"
					description="Sie können jetzt an der Videokonferenz teilnehmen."
					actionLabel="Beitreten"
					onAction={onJoin}
				/>
			</Bubble>
		</Timeline>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Zustand, den heute niemand je zu Gesicht bekommt. Wichtig für das Backend-Ticket: „läuft" darf nicht heißen „das ist die letzte Anruf-Nachricht" — genau das prüft `findLastVideoCallIndex` heute, ohne zu wissen, ob der Anruf noch steht. Es braucht ein echtes Lebenszyklus-Ereignis.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const joinButton = canvas.getByRole('button', { name: 'Beitreten' });
		await expect(joinButton).toBeVisible();
		await userEvent.click(joinButton);
		await expect(onJoin).toHaveBeenCalled();
	}
};

export const EndedLog: StoryObj = {
	name: 'Beendet — Protokollzeile',
	render: () => (
		<Timeline>
			<Bubble side="sent" label="Ich habe den Anruf gestartet · beendet">
				<CallTimelineSystemMessage
					state="ended"
					headline="Du hast den Videoanruf beendet"
					statusLabel="Beendet"
					durationLabel="Dauer 29 Min."
					description="Der Videoanruf ist beendet."
				/>
			</Bubble>
		</Timeline>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Derselbe Eintrag nach dem Anruf: Dauer statt Knopf. Kein zweiter Eintrag, keine zweite Nachricht — der Verlauf soll nicht doppelt erzählen, was einmal passiert ist.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Dauer 29 Min.')).toBeVisible();
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}
};

export const Mobile: StoryObj = {
	name: 'Mobil (375 pt)',
	globals: phone375Globals,
	render: () => (
		<Timeline>
			<Bubble side="received" label="Jemand anderes · läuft">
				<CallTimelineSystemMessage
					state="running"
					headline="Beraterin Carimat hat einen Videoanruf gestartet"
					statusLabel="Läuft"
					description="Sie können jetzt an der Videokonferenz teilnehmen."
					actionLabel="Beitreten"
					onAction={onJoin}
				/>
			</Bubble>
			<Bubble side="sent" label="Ich · beendet">
				<CallTimelineSystemMessage
					state="ended"
					headline="Du hast den Videoanruf beendet"
					statusLabel="Beendet"
					durationLabel="Dauer 29 Min."
					description="Der Videoanruf ist beendet."
				/>
			</Bubble>
		</Timeline>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Auf dem Telefon: die Illustration neben dem Text kostet dort Breite, die der Knopf braucht. Hier entscheidet sich, ob die Illustration mobil bleibt.'
			}
		}
	}
};

export const Tablet: StoryObj = {
	name: 'Tablet (834 pt)',
	globals: tablet834Globals,
	render: AllFourStates.render,
	parameters: { layout: 'fullscreen' }
};

export const Desktop: StoryObj = {
	name: 'Desktop (1440 pt)',
	globals: desktop1440Globals,
	render: AllFourStates.render,
	parameters: { layout: 'fullscreen' }
};
