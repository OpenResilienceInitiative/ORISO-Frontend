import * as React from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	ChatMenuDropdown,
	ChatMenuDropdownCollapsibleGroup,
	ChatMenuDropdownDivider,
	ChatMenuDropdownGroupLabel,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem,
	ChatMenuDropdownSection
} from '../chatMenuDropdown/ChatMenuDropdown';
import { GdprIcon } from '../../resources/img/icons';
import { ReactComponent as VideoIcon } from '../../resources/img/icons/modality-video.svg';
import { ReactComponent as AudioIcon } from '../../resources/img/icons/timeline-add-call.svg';
import { ReactComponent as TeamChatIcon } from '../../resources/img/icons/speech-bubble-team.svg';
import { ReactComponent as SupervisionIcon } from '../../resources/img/icons/supervision_nocirc_400_24px.svg';
import { ReactComponent as ChangeSupervisorIcon } from '../../resources/img/icons/person-circle.svg';
import { ReactComponent as AppointmentIcon } from '../../resources/img/icons/calendar-plus.svg';
import { ReactComponent as SupervisorAppointmentIcon } from '../../resources/img/icons/calendar.svg';
import { ReactComponent as ProfileIcon } from '../../resources/img/icons/profil_outline.svg';
import { ReactComponent as NewLinkIcon } from '../../resources/img/icons/url.svg';
import { ReactComponent as KeepAccountIcon } from '../../resources/img/icons/add-shield.svg';
import { ReactComponent as AdviceIcon } from '../../resources/img/icons/persons-two.svg';
import { ReactComponent as RecommendIcon } from '../../resources/img/icons/arrow-forward.svg';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/case_handover_200_24px.svg';
import { ReactComponent as EndDuplicateIcon } from '../../resources/img/icons/close-circle.svg';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox_outline.svg';
import { ReactComponent as NotificationIcon } from '../../resources/img/icons/notification_settings.svg';

/**
 * Structure proposals for the chat room's "Weitere Funktionen" (⋮) menu.
 *
 * The menu grew one row per feature (calls, team chat, supervision,
 * appointments, people, handover, legal) into a flat list of up to ~20 rows
 * with a single divider. These stories lay the same rows out three ways so
 * the product owner can pick one before `SessionMenu` changes.
 *
 * Every story shows the fullest counsellor case (1:1 session, mobile with
 * calls in the menu, team chat on, supervision active, guest account).
 * Rows marked "(in Arbeit)" come from the open side-chat/supervision branch.
 * Copy follows the `de` bundle; icons all come from
 * `src/resources/img/icons` (no MUI glyphs, unlike today's three rows).
 */
const meta: Meta = {
	title: 'Organisms/SessionMenu/Structure proposals',
	parameters: { layout: 'centered' }
};

export default meta;
type Story = StoryObj;

type Row = {
	key: string;
	icon: React.ReactNode;
	title: string;
	description?: string;
	shortcut?: string;
};

const ROWS: Record<string, Row> = {
	video: { key: 'video', icon: <VideoIcon />, title: 'Video-Call starten' },
	audio: { key: 'audio', icon: <AudioIcon />, title: 'Audio-Call starten' },
	appointment: {
		key: 'appointment',
		icon: <AppointmentIcon />,
		title: 'Termin anlegen'
	},
	teamChat: {
		key: 'teamChat',
		icon: <TeamChatIcon />,
		title: 'Team-Chat öffnen'
	},
	supervision: {
		key: 'supervision',
		icon: <SupervisionIcon />,
		title: 'Supervision'
	},
	changeSupervisor: {
		key: 'changeSupervisor',
		icon: <ChangeSupervisorIcon />,
		title: 'Supervisor:in ändern (in Arbeit)'
	},
	supervisorAppointment: {
		key: 'supervisorAppointment',
		icon: <SupervisorAppointmentIcon />,
		title: 'Termin mit Supervisor:in vereinbaren (in Arbeit)'
	},
	requestAdvice: {
		key: 'requestAdvice',
		icon: <AdviceIcon />,
		title: 'Rat einholen'
	},
	profile: {
		key: 'profile',
		icon: <ProfileIcon />,
		title: 'Ratsuchendenprofil',
		shortcut: '⇧P'
	},
	newLink: {
		key: 'newLink',
		icon: <NewLinkIcon />,
		title: 'Neuen Link senden'
	},
	keepAccount: {
		key: 'keepAccount',
		icon: <KeepAccountIcon />,
		title: 'Konto behalten'
	},
	recommend: {
		key: 'recommend',
		icon: <RecommendIcon />,
		title: 'Weitere Beratung empfehlen'
	},
	handover: {
		key: 'handover',
		icon: <HandoverIcon />,
		title: 'Beratung übergeben'
	},
	endDuplicate: {
		key: 'endDuplicate',
		icon: <EndDuplicateIcon />,
		title: 'Doppelte Beratung beenden'
	},
	archive: {
		key: 'archive',
		icon: <ArchiveIcon />,
		title: 'Archivieren',
		description:
			'Bei archivierten Chats sind Benachrichtigungen inaktiv. Der Chat wird in 12 Monaten gelöscht.'
	},
	notifications: {
		key: 'notifications',
		icon: <NotificationIcon />,
		title: 'Benachrichtigungen einstellen'
	},
	privacy: {
		key: 'privacy',
		icon: <GdprIcon aria-hidden="true" />,
		title: 'Datenschutzerklärung'
	},
	imprint: {
		key: 'imprint',
		icon: <GdprIcon aria-hidden="true" />,
		title: 'Impressum'
	}
};

const rows = (...keys: string[]) =>
	keys.map((key) => {
		const { icon, title, description, shortcut } = ROWS[key];
		return (
			<ChatMenuDropdownItem
				key={key}
				icon={icon}
				title={title}
				description={description}
				shortcut={shortcut}
				data-cy={`menu-row-${key}`}
			/>
		);
	});

const Card = ({ children }: { children: React.ReactNode }) => (
	<ChatMenuDropdown
		ariaLabel="Chatraum Einstellungen"
		style={{ width: 320, maxHeight: 'none' }}
	>
		<ChatMenuDropdownHeader
			subtitle="Jeder Raum individuell anpassbar"
			title="Chatraum Einstellungen"
		/>
		<ChatMenuDropdownDivider />
		{children}
	</ChatMenuDropdown>
);

/** Today on `dev`: one flat list, one divider under the header. */
export const Today: Story = {
	name: 'Heute (flache Liste)',
	render: () => (
		<Card>
			<ChatMenuDropdownSection>
				{rows(
					'video',
					'audio',
					'teamChat',
					'appointment',
					'keepAccount',
					'newLink',
					'profile',
					'notifications',
					'supervision',
					'changeSupervisor',
					'supervisorAppointment',
					'requestAdvice',
					'recommend',
					'handover',
					'endDuplicate',
					'archive',
					'privacy',
					'imprint'
				)}
			</ChatMenuDropdownSection>
		</Card>
	)
};

/**
 * Variant A — every row stays visible, sorted into named groups with a grey
 * heading and a divider between groups. Nothing to click open; the menu is
 * as long as today but easier to scan.
 */
export const VariantAGroups: Story = {
	name: 'Variante A: Gruppen mit Überschriften',
	render: () => (
		<Card>
			<ChatMenuDropdownGroupLabel>Gespräch</ChatMenuDropdownGroupLabel>
			<ChatMenuDropdownSection>
				{rows('video', 'audio', 'appointment')}
			</ChatMenuDropdownSection>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownGroupLabel>
				Team &amp; Supervision
			</ChatMenuDropdownGroupLabel>
			<ChatMenuDropdownSection>
				{rows(
					'teamChat',
					'supervision',
					'changeSupervisor',
					'supervisorAppointment',
					'requestAdvice'
				)}
			</ChatMenuDropdownSection>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownGroupLabel>
				Ratsuchende:r
			</ChatMenuDropdownGroupLabel>
			<ChatMenuDropdownSection>
				{rows('profile', 'newLink', 'keepAccount')}
			</ChatMenuDropdownSection>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownGroupLabel>Beratung</ChatMenuDropdownGroupLabel>
			<ChatMenuDropdownSection>
				{rows('recommend', 'handover', 'endDuplicate', 'archive')}
			</ChatMenuDropdownSection>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownGroupLabel>
				Einstellungen &amp; Rechtliches
			</ChatMenuDropdownGroupLabel>
			<ChatMenuDropdownSection>
				{rows('notifications', 'privacy', 'imprint')}
			</ChatMenuDropdownSection>
		</Card>
	)
};

/**
 * Variant B (recommended) — the daily rows stay on top without a heading
 * (calls, appointment, team chat, supervision, profile). Everything used
 * now and then sits in three foldable groups, closed by default.
 * Archivieren stays visible at the bottom because it closes most cases.
 */
export const VariantBFrequentFirst: Story = {
	name: 'Variante B: Häufiges oben, Rest einklappbar (Empfehlung)',
	render: () => (
		<Card>
			<ChatMenuDropdownSection>
				{rows(
					'video',
					'audio',
					'appointment',
					'teamChat',
					'supervision',
					'profile'
				)}
			</ChatMenuDropdownSection>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownCollapsibleGroup
				label="Beratung weitergeben"
				data-cy="group-handover"
			>
				{rows('requestAdvice', 'recommend', 'handover', 'endDuplicate')}
			</ChatMenuDropdownCollapsibleGroup>
			<ChatMenuDropdownCollapsibleGroup label="Supervision verwalten">
				{rows('changeSupervisor', 'supervisorAppointment')}
			</ChatMenuDropdownCollapsibleGroup>
			<ChatMenuDropdownCollapsibleGroup label="Ratsuchende:r & Konto">
				{rows('newLink', 'keepAccount')}
			</ChatMenuDropdownCollapsibleGroup>
			<ChatMenuDropdownCollapsibleGroup label="Einstellungen & Rechtliches">
				{rows('notifications', 'privacy', 'imprint')}
			</ChatMenuDropdownCollapsibleGroup>
			<ChatMenuDropdownDivider />
			<ChatMenuDropdownSection>{rows('archive')}</ChatMenuDropdownSection>
		</Card>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole('button', {
			name: 'Beratung weitergeben'
		});
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(
			canvas.queryByRole('button', { name: 'Beratung übergeben' })
		).toBeNull();
		await userEvent.click(toggle);
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(
			canvas.getByRole('button', { name: 'Beratung übergeben' })
		).toBeVisible();
	}
};

/**
 * Variant C — accordion: every group is foldable, only "Gespräch" is open
 * at the start. Shortest menu, but every rarer action costs one more click
 * and the reader must know which group holds it.
 */
export const VariantCAccordion: Story = {
	name: 'Variante C: Alle Gruppen einklappbar',
	render: () => (
		<Card>
			<ChatMenuDropdownCollapsibleGroup label="Gespräch" defaultOpen>
				{rows('video', 'audio', 'appointment')}
			</ChatMenuDropdownCollapsibleGroup>
			<ChatMenuDropdownCollapsibleGroup label="Team & Supervision">
				{rows(
					'teamChat',
					'supervision',
					'changeSupervisor',
					'supervisorAppointment',
					'requestAdvice'
				)}
			</ChatMenuDropdownCollapsibleGroup>
			<ChatMenuDropdownCollapsibleGroup label="Ratsuchende:r">
				{rows('profile', 'newLink', 'keepAccount')}
			</ChatMenuDropdownCollapsibleGroup>
			<ChatMenuDropdownCollapsibleGroup label="Beratung">
				{rows('recommend', 'handover', 'endDuplicate', 'archive')}
			</ChatMenuDropdownCollapsibleGroup>
			<ChatMenuDropdownCollapsibleGroup label="Einstellungen & Rechtliches">
				{rows('notifications', 'privacy', 'imprint')}
			</ChatMenuDropdownCollapsibleGroup>
		</Card>
	)
};
