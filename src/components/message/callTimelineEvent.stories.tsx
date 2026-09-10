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
 * This permanent approval surface keeps sent/received and running/ended call
 * events reviewable independently of a live room. The application renderer
 * consumes call lifecycle events through `MessageItemComponent`; Storybook
 * supplies deterministic members, labels and timestamps for visual checks.
 */
const meta: Meta = {
	title: 'Chat/Call event in the timeline',
	parameters: {
		docs: {
			description: {
				component:
					'Das Anruf-Ereignis im Chatverlauf: gesendet und empfangen, jeweils laufend und beendet. Die dauerhafte Abnahmefläche zeigt zusätzlich Audio/Video, Mitglieder und geplante Calls mit Kalenderaktion.'
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
		userId: '@beraterin-lea:oriso.org',
		username: 'beraterin_lea',
		displayName: 'Beraterin Lea'
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
					side="sent"
					headline="Sanftes Alpaka Kim"
					statusLabel="Läuft"
					actionSummaryLabel="Videoanruf beitreten"
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
					headline="Beraterin Lea"
					statusLabel="Läuft"
					actionSummaryLabel="Videoanruf beitreten"
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
					side="sent"
					headline="Sanftes Alpaka Kim"
					statusLabel="Beendet"
					actionSummaryLabel="Videoanruf beendet"
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
					headline="Beraterin Lea"
					statusLabel="Beendet"
					actionSummaryLabel="Videoanruf beendet"
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
				story: 'Die vier Zustände untereinander. Laufend trägt der Eintrag den Beitreten-Knopf; beendet wird derselbe Eintrag zur Protokollzeile mit Dauer. Die Senderseite bestimmt Ausrichtung, Farbe, Avatar und CTA-Position.'
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
					headline="Beraterin Lea"
					statusLabel="Läuft"
					actionSummaryLabel="Videoanruf beitreten"
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
				story: 'Der laufende Zustand mit Beitreten-Aktion. Der Status stammt aus einem echten Lebenszyklus-Ereignis und darf nicht allein aus der Position der letzten Anruf-Nachricht abgeleitet werden.'
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
					side="sent"
					headline="Sanftes Alpaka Kim"
					statusLabel="Beendet"
					actionSummaryLabel="Videoanruf beendet"
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
					headline="Beraterin Lea"
					statusLabel="Läuft"
					actionSummaryLabel="Videoanruf beitreten"
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
					side="sent"
					headline="Sanftes Alpaka Kim"
					statusLabel="Beendet"
					actionSummaryLabel="Videoanruf beendet"
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
					headline="Beraterin Lea"
					statusLabel="Läuft"
					actionSummaryLabel="Videoanruf beitreten"
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
					headline="Beraterin Lea"
					statusLabel="Läuft"
					actionSummaryLabel="Audioanruf beitreten"
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
					side="sent"
					headline="Sanftes Alpaka Kim"
					statusLabel="Beendet"
					actionSummaryLabel="Videoanruf beendet"
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
					side="sent"
					headline="Sanftes Alpaka Kim"
					statusLabel="Beendet"
					actionSummaryLabel="Audioanruf beendet"
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
					headline="Beraterin Lea"
					statusLabel="Geplant"
					actionSummaryLabel="Videoanruf Termin eintragen"
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
					headline="Beraterin Lea"
					statusLabel="Geplant"
					actionSummaryLabel="Audioanruf Termin eintragen"
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
