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

/** A conversation list column: real cards and deleted ones in one rhythm. */
const ListColumn = ({ children }: { children: React.ReactNode }) => (
	<RuntimeSessionProviders sessions={[runtimeSession]}>
		<div
			className="sessionsList__scrollContainer"
			role="list"
			aria-label="Conversations"
			style={{
				maxWidth: 390,
				margin: '0 auto',
				padding: '12px 0',
				background: 'var(--m3-surface-container, #f3eded)'
			}}
		>
			{children}
		</div>
	</RuntimeSessionProviders>
);

/** The conversation list: two deleted chats between real conversations. */
export const InTheList: Story = {
	args: { row: row(77, '2026-11-16'), locale: 'de', translate: (k) => k },
	render: () => (
		<ListColumn>
			<Card value={row(77, '2026-11-16')} />
			<RuntimeSessionCard session={runtimeSession} index={0} />
			<Card value={row(78, '2026-11-12')} />
		</ListColumn>
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
		// Same card: same width and corner radius as a real conversation.
		await expect(deleted.getBoundingClientRect().width).toBeCloseTo(
			real.getBoundingClientRect().width,
			0
		);
		await expect(getComputedStyle(deleted).borderRadius).toBe(
			getComputedStyle(real).borderRadius
		);
		await expect(getComputedStyle(deleted).borderStyle).not.toBe('dashed');
	}
};

/** Opened: the card is the selected one, like an open conversation. */
export const Active: Story = {
	args: { row: row(77, '2026-11-16'), locale: 'de', translate: (k) => k },
	render: () => (
		<ListColumn>
			<Card value={row(77, '2026-11-16')} isActive />
		</ListColumn>
	)
};

/** In the archive tab, after the counsellor moved it there. */
export const Archived: Story = {
	args: { row: row(77, '2026-11-16'), locale: 'de', translate: (k) => k },
	render: () => (
		<ListColumn>
			<Card value={row(77, '2026-11-16', true)} />
		</ListColumn>
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
		<ListColumn>
			<Card value={args.row} onOpen={args.onOpen} />
		</ListColumn>
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
