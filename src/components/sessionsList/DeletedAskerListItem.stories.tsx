import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DeletedAskerListItem } from './DeletedAskerListItem';
import type { DeletedAskerRow } from './deletedAskerRows';
import {
	RuntimeSessionCard,
	RuntimeSessionProviders,
	runtimeSession
} from '../sessionsListItem/__storybook__/runtimeSessionCard';
import './sessionsList.styles.scss';

/**
 * ORISO-Frontend#1159: the card of a deleted advice-seeker chat. Same card
 * family as every conversation — chip row with date, avatar slot (neutral),
 * title, one muted line — replacing the dashed box that broke the list.
 */
const meta = {
	title: 'Components/Session/List/DeletedAskerCard',
	component: DeletedAskerListItem,
	tags: ['autodocs'],
	parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof DeletedAskerListItem>;
export default meta;

type Story = StoryObj<typeof meta>;

const row = (
	formerSessionId: number,
	day: string,
	archived = false
): DeletedAskerRow => ({
	key: `deleted-asker:${formerSessionId}`,
	formerSessionId,
	timestamp: Date.parse(`${day}T09:30:00Z`),
	archived
});

const Card = ({
	value,
	isActive,
	onOpen
}: {
	value: DeletedAskerRow;
	isActive?: boolean;
	onOpen?: (row: DeletedAskerRow) => void;
}) => {
	const { t, i18n } = useTranslation();
	return (
		<DeletedAskerListItem
			row={value}
			locale={i18n.language || 'de'}
			translate={t}
			isActive={isActive}
			onOpen={onOpen ?? (() => undefined)}
		/>
	);
};

/**
 * The real scroller of the conversation list (`SessionsList`): cards sit in
 * `sessionsList__scrollContainer` with the list's grouping, so they form one
 * outline with corners only at the ends — no story-only container or gaps.
 */
type ListEntry =
	| {
			kind: 'deleted';
			row: DeletedAskerRow;
			active?: boolean;
	  }
	| { kind: 'session' };

const GroupedList = ({ entries }: { entries: ListEntry[] }) => {
	const { t, i18n } = useTranslation();
	const active = entries.map(
		(entry) => entry.kind === 'deleted' && !!entry.active
	);
	return (
		<RuntimeSessionProviders sessions={[runtimeSession]}>
			<div
				className="sessionsList__wrapper"
				style={{ maxWidth: 420, margin: '0 auto' }}
			>
				<div className="sessionsList__scrollArea">
					<div
						className="sessionsList__scrollContainer sessionsList__scrollContainer--hasToolbar"
						role="list"
						aria-label="Conversations"
					>
						{entries.map((entry, index) => {
							const edges = {
								isGroupStart: index === 0 || active[index - 1],
								isGroupEnd:
									index === entries.length - 1 ||
									active[index + 1],
								isBeforeActive: !!active[index + 1],
								isAfterActive: !!active[index - 1]
							};
							return entry.kind === 'deleted' ? (
								<DeletedAskerListItem
									key={entry.row.key}
									row={entry.row}
									locale={i18n.language || 'de'}
									translate={t}
									isActive={entry.active}
									grouped
									edges={edges}
									onOpen={() => undefined}
								/>
							) : (
								<RuntimeSessionCard
									key={`session-${index}`}
									session={runtimeSession}
									index={index}
									grouped
									{...edges}
								/>
							);
						})}
					</div>
				</div>
			</div>
		</RuntimeSessionProviders>
	);
};

/** Bottom of one card touches the top of the next: one continuous outline. */
const expectOneOutline = async (canvasElement: HTMLElement) => {
	const cards = [
		...canvasElement.querySelectorAll('.sessionsListItem')
	] as HTMLElement[];
	for (let i = 1; i < cards.length; i += 1) {
		const above = cards[i - 1].getBoundingClientRect();
		const below = cards[i].getBoundingClientRect();
		await expect(Math.round(below.top - above.bottom)).toBe(0);
	}
	const radius = (card: HTMLElement) =>
		getComputedStyle(
			card.querySelector('.sessionsListItem__content') as Element
		);
	await expect(radius(cards[0]).borderBottomLeftRadius).toBe('0px');
	await expect(radius(cards[cards.length - 1]).borderTopLeftRadius).toBe(
		'0px'
	);
};

/** The conversation list: two deleted chats between real conversations. */
export const InTheList: Story = {
	args: { row: row(77, '2026-11-16'), locale: 'de', translate: (k) => k },
	render: () => (
		<GroupedList
			entries={[
				{ kind: 'deleted', row: row(77, '2026-11-16') },
				{ kind: 'session' },
				{ kind: 'deleted', row: row(78, '2026-11-12') }
			]}
		/>
	),
	play: async ({ canvasElement }) => {
		const cards = canvasElement.querySelectorAll(
			'[data-cy="sessions-list-deleted-asker-item"]'
		);
		await expect(cards).toHaveLength(2);
		const real = canvasElement.querySelector(
			'[data-cy="session-list-item"] .sessionsListItem__content'
		) as HTMLElement;
		const deleted = cards[0].querySelector(
			'.sessionsListItem__content'
		) as HTMLElement;
		// Same card: same width as a real conversation, never dashed.
		await expect(deleted.getBoundingClientRect().width).toBeCloseTo(
			real.getBoundingClientRect().width,
			0
		);
		await expect(getComputedStyle(deleted).borderStyle).not.toBe('dashed');
		await expectOneOutline(canvasElement);
	}
};

/** Opened: the card is the selected one, like an open conversation. */
export const Active: Story = {
	args: { row: row(77, '2026-11-16'), locale: 'de', translate: (k) => k },
	render: () => (
		<GroupedList
			entries={[
				{ kind: 'session' },
				{ kind: 'deleted', row: row(77, '2026-11-16'), active: true },
				{ kind: 'session' }
			]}
		/>
	)
};

/** In the archive tab, after the counsellor moved it there. */
export const Archived: Story = {
	args: { row: row(77, '2026-11-16'), locale: 'de', translate: (k) => k },
	render: () => (
		<GroupedList
			entries={[{ kind: 'deleted', row: row(77, '2026-11-16', true) }]}
		/>
	)
};

/** Clicking or pressing Enter opens the deletion notice. */
export const OpensTheNotice: Story = {
	args: {
		row: row(77, '2026-11-16'),
		locale: 'de',
		translate: (k) => k,
		onOpen: fn()
	},
	render: (args) => (
		<div
			className="sessionsList__scrollContainer"
			role="list"
			aria-label="Conversations"
			style={{ maxWidth: 420, margin: '0 auto' }}
		>
			<Card value={args.row} onOpen={args.onOpen} />
		</div>
	),
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const card = canvas.getByRole('listitem', {
			name: /Gelöschte:r Ratsuchende:r|Deleted advice seeker/
		});
		await userEvent.click(card);
		card.focus();
		await userEvent.keyboard('{Enter}');
		await expect(args.onOpen).toHaveBeenCalledTimes(2);
		await expect(args.onOpen).toHaveBeenCalledWith(args.row);
	}
};

/**
 * Frank, 2026-11-25: the deleted chat is the normal card with other words,
 * inside the same outline. The topic chip stays where it is
 * known; only an unknown topic reads "gelöscht". Top: topic known (chat
 * marked for deletion). Middle: a real conversation. Bottom: placeholder
 * after the hard deletion, topic gone.
 */
export const TopicKnownAndUnknown: Story = {
	args: { row: row(77, '2026-11-23'), locale: 'de', translate: (k) => k },
	render: () => (
		<GroupedList
			entries={[
				{
					kind: 'deleted',
					row: {
						...row(77, '2026-11-23'),
						topic: 'Allgemeine Sozialberatung'
					}
				},
				{ kind: 'session' },
				{ kind: 'session' },
				{ kind: 'deleted', row: row(78, '2026-11-12') }
			]}
		/>
	),
	play: async ({ canvasElement }) => {
		const chips = canvasElement.querySelectorAll(
			'[data-cy="sessions-list-deleted-asker-item"] .topicTag'
		);
		await expect(chips).toHaveLength(2);
		await expect(chips[0]).toHaveTextContent('Allgemeine Sozialberatung');
		await expectOneOutline(canvasElement);
	}
};
