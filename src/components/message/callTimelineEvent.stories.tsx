import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, fn, within } from 'storybook/test';
import { CallTimelineSystemMessage } from './CallTimelineSystemMessage';
import { GroupChatCalendarMenu } from '../groupChat/GroupChatCalendarMenu';
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
const callMembers = [
	{
		userId: '@sanftes-yak:oriso.org',
		username: 'sanftes_yak',
		displayName: 'Sanftes Yak'
	},
	{
		userId: '@ruhiger-wolf:oriso.org',
		username: 'ruhiger_wolf',
		displayName: 'Ruhiger Wolf'
	},
	{
		userId: '@beraterin-carimat:oriso.org',
		username: 'beraterin_carimat',
		displayName: 'Beraterin Carimat'
	}
] as const;
const scheduledStart = new Date('2026-09-10T16:00:00.000Z');

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
					callType="video"
					callLabel="Videoanruf"
					headline="Du hast einen Videoanruf gestartet"
					statusLabel="Läuft"
					description="Die anderen Teilnehmenden können dem Videoanruf jetzt beitreten."
					actionLabel="Zum Videoanruf"
					onAction={onJoin}
					participants={callMembers}
					participantsLabel="Im Anruf"
				/>
			</Bubble>
			<Bubble side="received" label="Jemand anderes · läuft">
				<CallTimelineSystemMessage
					state="running"
					callType="video"
					callLabel="Videoanruf"
					headline="Beraterin Carimat hat einen Videoanruf gestartet"
					statusLabel="Läuft"
					description="Sie können jetzt an der Videokonferenz teilnehmen."
					actionLabel="Beitreten"
					onAction={onJoin}
					participants={callMembers}
					participantsLabel="Im Anruf"
				/>
			</Bubble>
			<Bubble side="sent" label="Ich habe den Anruf gestartet · beendet">
				<CallTimelineSystemMessage
					state="ended"
					callType="video"
					callLabel="Videoanruf"
					headline="Du hast den Videoanruf beendet"
					statusLabel="Beendet"
					durationLabel="Dauer 29 Min."
					description="Der Videoanruf ist beendet."
					participants={callMembers}
					participantsLabel="Teilgenommen"
				/>
			</Bubble>
			<Bubble side="received" label="Jemand anderes · beendet">
				<CallTimelineSystemMessage
					state="ended"
					callType="video"
					callLabel="Videoanruf"
					headline="Beraterin Carimat hat den Videoanruf beendet"
					statusLabel="Beendet"
					durationLabel="Dauer 29 Min."
					description="Der Videoanruf ist beendet."
					participants={callMembers}
					participantsLabel="Teilgenommen"
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
					callType="video"
					callLabel="Videoanruf"
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
		await expect(joinButton).toBeInTheDocument();
		joinButton.click();
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
					callType="video"
					callLabel="Videoanruf"
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
		await expect(canvas.getByText('Dauer 29 Min.')).toBeInTheDocument();
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
					callType="video"
					callLabel="Videoanruf"
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
					callType="video"
					callLabel="Videoanruf"
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

export const VideoAndAudio: StoryObj = {
	name: 'Video und Audio · Mitglieder live und danach',
	render: () => (
		<Timeline>
			<Bubble side="received" label="Video · läuft">
				<CallTimelineSystemMessage
					state="running"
					callType="video"
					callLabel="Videoanruf"
					headline="Beraterin Carimat hat einen Videoanruf gestartet"
					statusLabel="Läuft"
					description="Sie können jetzt an der Videokonferenz teilnehmen."
					participants={callMembers}
					participantsLabel="Im Anruf"
					actionLabel="Beitreten"
					onAction={onJoin}
				/>
			</Bubble>
			<Bubble side="received" label="Audio · läuft">
				<CallTimelineSystemMessage
					state="running"
					callType="audio"
					callLabel="Audioanruf"
					headline="Beraterin Carimat hat einen Audioanruf gestartet"
					statusLabel="Läuft"
					description="Sie können jetzt am Audioanruf teilnehmen."
					participants={callMembers.slice(0, 2)}
					participantsLabel="Im Anruf"
					actionLabel="Beitreten"
					onAction={onJoin}
				/>
			</Bubble>
			<Bubble side="sent" label="Video · beendet">
				<CallTimelineSystemMessage
					state="ended"
					callType="video"
					callLabel="Videoanruf"
					headline="Du hast den Videoanruf beendet"
					statusLabel="Beendet"
					durationLabel="Dauer 29 Min."
					description="Der Videoanruf ist beendet."
					participants={callMembers}
					participantsLabel="Teilgenommen"
				/>
			</Bubble>
			<Bubble side="sent" label="Audio · beendet">
				<CallTimelineSystemMessage
					state="ended"
					callType="audio"
					callLabel="Audioanruf"
					headline="Du hast den Audioanruf beendet"
					statusLabel="Beendet"
					durationLabel="Dauer 18 Min."
					description="Der Audioanruf ist beendet."
					participants={callMembers.slice(0, 2)}
					participantsLabel="Teilgenommen"
				/>
			</Bubble>
		</Timeline>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Video und Audio verwenden dieselbe M3-Systemnachricht. Während des Calls zeigt sie die aktuellen Mitglieder; danach bleibt der abschließende Teilnehmer-Snapshot nachvollziehbar.'
			}
		}
	}
};

export const ScheduledWithCalendar: StoryObj = {
	name: 'Geplant · mit Kalender-Menü',
	render: () => (
		<Timeline>
			<Bubble side="received" label="Video · geplant">
				<CallTimelineSystemMessage
					state="scheduled"
					callType="video"
					callLabel="Videoanruf"
					headline="Beraterin Carimat hat einen Videoanruf geplant"
					statusLabel="Geplant"
					scheduledForLabel="Do., 10. September · 18:00 Uhr"
					description="Der Termin dauert 60 Minuten. Sie können ihn direkt in Ihren Kalender übernehmen."
					actionSlot={
						<GroupChatCalendarMenu
							start={scheduledStart}
							durationMinutes={60}
							eventId="storybook-video-call-1"
						/>
					}
				/>
			</Bubble>
			<Bubble side="received" label="Audio · geplant">
				<CallTimelineSystemMessage
					state="scheduled"
					callType="audio"
					callLabel="Audioanruf"
					headline="Beraterin Carimat hat einen Audioanruf geplant"
					statusLabel="Geplant"
					scheduledForLabel="Fr., 11. September · 10:30 Uhr"
					description="Der Termin dauert 30 Minuten. Sie können ihn direkt in Ihren Kalender übernehmen."
					actionSlot={
						<GroupChatCalendarMenu
							start={new Date('2026-09-11T08:30:00.000Z')}
							durationMinutes={30}
							eventId="storybook-audio-call-1"
						/>
					}
				/>
			</Bubble>
		</Timeline>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Geplante Calls verwenden exakt das bestehende, datenschutzneutrale Kalender-Menü der Selbsthilfegruppe: ICS, Google Calendar und Outlook.'
			}
		}
	}
};
