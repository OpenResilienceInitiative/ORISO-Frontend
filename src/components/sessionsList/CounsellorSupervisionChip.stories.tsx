import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { SessionsListToolbar } from './SessionsListToolbar';
import type { SessionToolbarChipFilter } from './sessionToolbarFilters';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import {
	RuntimeSessionCard,
	RuntimeSessionProviders,
	runtimeSession
} from '../sessionsListItem/__storybook__/runtimeSessionCard';
import {
	DisplayFilterDialog,
	SESSION_COLUMNS
} from '../displayFilter/DisplayFilterDialog';
import {
	EMPTY_DISPLAY_FILTER,
	type DisplayFilterValue
} from '../displayFilter/displayFilterTypes';
import {
	SESSION_KINDS,
	SESSION_STORY_LABELS
} from '../displayFilter/displayFilterStoryData';
import { desktop1440Globals } from '../message/messageStoryShell';
import { useActiveListItem } from '../../hooks/useActiveListItem';
import { buildExtendedSession } from '../../globalState/helpers/stateHelpers';
import { SupervisionIconButton } from '../sessionsListItem/SupervisionIconButton';
import { TeamDiscussionIconButton } from '../teamDiscussion/TeamDiscussionBadge';
import './sessionsList.styles.scss';

/**
 * ORISO-Frontend#2494 *5 (P0 v2.0.18): the "Supervision" chip for
 * counsellors. Today only a supervisor sees it. New: a counsellor sees it as
 * soon as one of their own cases is under supervision, and it filters to
 * those cases. In "Ansicht einstellen" the row "Supervision" gets the same
 * picker as Live-Chat (without "Bei Sitzung"): Dynamisch (default, appears
 * by itself) · Fest (always, pinned) · Aus.
 *
 * Components: `SessionsListToolbar` (sessionsList/SessionsListToolbar), the
 * real session cards (`RuntimeSessionCard`), `DisplayFilterDialog`
 * (displayFilter/DisplayFilterDialog) with the new kind option `autoModes`.
 */
const ME = 'consultant-me';
const SUPERVISOR = 'consultant-angela';

const row = (
	id: number,
	name: string,
	note: string,
	supervised: boolean
): ListItemInterface => ({
	...runtimeSession,
	consultant: { ...runtimeSession.consultant, consultantId: ME, id: ME },
	user: { ...runtimeSession.user, username: name, displayName: name },
	session: {
		...runtimeSession.session,
		id,
		matrixRoomId: `!p0-supervision-${id}:example.org`,
		lastMessage: note,
		messagesRead: true,
		conversationType: 'AGENCY_COUNSELLING',
		...(supervised
			? {
					supervision: {
						supervisedByMe: false,
						supervisorConsultantIds: [SUPERVISOR],
						supervisorDisplayNames: ['Angela K'],
						counsellorDisplayName: 'Karina P'
					}
				}
			: {})
	} as unknown as ListItemInterface['session']
});

const ROWS = [
	row(201, 'Sanftes Alpaka Kala', 'Danke für den Termin morgen.', true),
	row(202, 'Mutiges Reh Nala', 'Ich melde mich nächste Woche.', false),
	row(203, 'Ruhiges Yak Kim', 'Können wir telefonieren?', true),
	row(204, 'Freundlicher Igel Toni', 'Hallo, ich habe eine Frage.', false)
];

/* Story stand-in for `isOwnCaseUnderSupervision` (sessionToolbarFilters):
   my own cases that someone supervises, plus the cases I supervise. */
const isSupervision = (raw: ListItemInterface) =>
	Boolean(
		(
			raw.session as unknown as {
				supervision?: { supervisorConsultantIds?: string[] };
			}
		).supervision?.supervisorConsultantIds?.length
	);

const shell: React.CSSProperties = {
	backgroundColor: 'var(--m3-surface-container, #eae7e8)',
	padding: 16,
	maxWidth: 520,
	margin: '0 auto'
};

function CounsellorList({
	rows,
	initialChip = null
}: {
	rows: ListItemInterface[];
	initialChip?: SessionToolbarChipFilter | null;
}) {
	const { t } = useTranslation();
	const [chip, setChip] = useState<SessionToolbarChipFilter | null>(
		initialChip
	);
	const supervised = rows.filter(isSupervision);
	const { isActive } = useActiveListItem();
	const visible = chip === 'supervision' ? supervised : rows;
	const activeIndex = visible.findIndex((raw) => {
		const session = buildExtendedSession(raw, '');
		return isActive({
			groupId: session.item.matrixRoomId,
			rid: session.rid,
			sessionId: session.item.id
		});
	});
	return (
		<div style={shell}>
			<SessionsListToolbar
				translate={t}
				searchValue=""
				onSearchChange={() => {}}
				activeChip={chip}
				onChipToggle={(next) =>
					setChip((prev) => (prev === next ? null : next))
				}
				showConsultantActions
				showCreateGroupChatAction
				showSupervisionChip={supervised.length > 0}
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={false}
				createGroupChatActive={false}
				chipCounts={{ supervision: supervised.length }}
			/>
			<RuntimeSessionProviders sessions={visible} viewerId={ME}>
				<div
					className="sessionsList__scrollContainer"
					role="list"
					aria-label="Conversations"
					style={{ margin: '12px 0 0' }}
				>
					{visible.map((raw, index) => (
						<div key={raw.session.id} data-cy="p0-supervision-row">
							<RuntimeSessionCard
								session={raw}
								index={index}
								grouped
								/* The same grouping as SessionsList: the open
								   row stands apart, its neighbours round. */
								isBeforeActive={index === activeIndex - 1}
								isAfterActive={index === activeIndex + 1}
								isGroupStart={
									index === 0 || index === activeIndex + 1
								}
								isGroupEnd={
									index === visible.length - 1 ||
									index === activeIndex - 1
								}
							/>
						</div>
					))}
				</div>
			</RuntimeSessionProviders>
		</div>
	);
}

const meta: Meta = {
	id: 'p0-v2018-5-supervision-chip',
	title: 'P0 v2.0.18/*5 Supervision-Filter für Berater:innen',
	globals: { locale: 'de', ...desktop1440Globals },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2494 *5: a counsellor with a case under supervision gets the "Supervision" chip automatically; it filters to those cases. "Ansicht einstellen" → Supervision → Im Filter: Dynamisch (default) / Fest / Aus.'
			}
		}
	}
};
export default meta;
type Story = StoryObj;

const chip = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLButtonElement>(
		'[data-cy="sessions-list-chip-supervision"]'
	);

/** 1: a counsellor with two supervised cases — the chip shows by itself. */
export const ChipAppears: Story = {
	name: '1 · Fall in Supervision → Chip erscheint',
	render: () => <CounsellorList rows={ROWS} />,
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(chip(canvasElement)).not.toBeNull());
	}
};

/** 2: chip on — only the counsellor's supervised cases stay. */
export const ChipFilters: Story = {
	name: '2 · Chip aktiv → nur Fälle in Supervision',
	render: () => <CounsellorList rows={ROWS} initialChip="supervision" />,
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelectorAll('[data-cy="p0-supervision-row"]')
		).toHaveLength(2);
	}
};

/** 3: no case under supervision — no chip (unless pinned "Fest"). */
export const NoSupervisedCase: Story = {
	name: '3 · Kein Fall in Supervision → kein Chip',
	render: () => (
		<CounsellorList rows={ROWS.filter((raw) => !isSupervision(raw))} />
	),
	play: async ({ canvasElement }) => {
		await expect(chip(canvasElement)).toBeNull();
	}
};

const KINDS = SESSION_KINDS.map((kind) =>
	kind.id === 'supervision' ? { ...kind, autoModes: true } : kind
);

function Settings() {
	const [value, setValue] =
		useState<DisplayFilterValue>(EMPTY_DISPLAY_FILTER);
	return (
		<DisplayFilterDialog
			open
			onClose={() => undefined}
			onReset={() => setValue(EMPTY_DISPLAY_FILTER)}
			kinds={KINDS}
			value={value}
			onChange={setValue}
			labels={SESSION_STORY_LABELS}
		/>
	);
}

/** 4: "Ansicht einstellen" — Supervision: Dynamisch / Fest / Aus. */
export const PinInSettings: Story = {
	name: '4 · Ansicht einstellen → Supervision anheften',
	render: () => <Settings />,
	play: async () => {
		const body = within(document.body);
		// The dialog mounts in a portal after the first frame.
		const picker = await waitFor(() => {
			const el = document.querySelector<HTMLElement>(
				'[data-cy="display-filter-row-supervision"]'
			);
			expect(el).not.toBeNull();
			return el;
		});
		const button = within(picker!)
			.getAllByRole('button')
			.find((el) => /Dynamisch/.test(el.textContent ?? ''))!;
		await userEvent.click(button);
		await expect(
			await body.findByRole('menuitemradio', { name: 'Fest' })
		).toBeInTheDocument();
	}
};

/**
 * 5 (Frank, 24 Nov): the marker in a row is one 32px round icon. Hover:
 * "Supervision: <Name>"; click opens the Supervision side panel (also on a
 * phone). Next to it the existing Team-Besprechung icon, the same pattern —
 * shown only while the team chat is active, not for archived cases.
 */
export const RowIcons: Story = {
	name: '5 · Zeile: Supervision- und Team-Icon (32 px)',
	render: () => (
		<div style={{ ...shell, display: 'flex', gap: 8 }}>
			<SupervisionIconButton
				supervisorNames={['Angela K']}
				onOpen={() => undefined}
			/>
			<TeamDiscussionIconButton onOpen={() => undefined} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button', {
			name: 'Supervision: Angela K'
		});
		await expect(button).toHaveAttribute('title', 'Supervision: Angela K');
		await expect(button.getBoundingClientRect().width).toBe(32);
	}
};
