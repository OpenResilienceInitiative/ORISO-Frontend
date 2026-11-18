// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DeletedAskerListItem } from './DeletedAskerListItem';

const translate = (key: string) =>
	({
		'sessionList.deletedAsker.title': 'Gelöschte:r Ratsuchende:r',
		'sessionList.deletedAsker.hint':
			'Dieser Chat wurde gelöscht. Persönliche Daten und Nachrichten sind nicht mehr verfügbar.'
	})[key] ?? key;

afterEach(cleanup);

describe('DeletedAskerListItem', () => {
	it('shows the neutral placeholder and the date, nothing else', () => {
		render(
			<DeletedAskerListItem
				row={{
					key: 'deleted-asker:7',
					formerSessionId: 7,
					timestamp: Date.parse('2026-10-29T09:30:00Z')
				}}
				locale="de"
				translate={translate}
			/>
		);

		expect(screen.getByText('Gelöschte:r Ratsuchende:r')).toBeTruthy();
		expect(screen.getByText('29.10.2026')).toBeTruthy();
		expect(screen.getByRole('listitem')).toBeTruthy();
	});

	it('is an ordinary session card: same card class, avatar, title, one muted line', () => {
		const { container } = render(
			<DeletedAskerListItem
				row={{ key: 'k', formerSessionId: 7, timestamp: 0 }}
				locale="de"
				translate={translate}
			/>
		);

		expect(container.querySelector('.sessionsListItem')).toBeTruthy();
		expect(container.querySelector('.sessionCard')).toBeTruthy();
		expect(screen.getByTestId('deleted-asker-avatar')).toBeTruthy();
		expect(
			screen.getByText('sessionList.deletedAsker.preview')
		).toBeTruthy();
		// The old ad-hoc dashed box is gone.
		expect(
			container.querySelector('.sessionsListDeletedAskerItem')
		).toBeNull();
	});

	it('opens the deletion notice on click and on Enter', () => {
		const onOpen = vi.fn();
		const row = { key: 'k', formerSessionId: 7, timestamp: 0 };
		render(
			<DeletedAskerListItem
				row={row}
				locale="de"
				translate={translate}
				onOpen={onOpen}
			/>
		);

		fireEvent.click(screen.getByRole('listitem'));
		fireEvent.keyDown(screen.getByRole('listitem'), { key: 'Enter' });

		expect(onOpen).toHaveBeenCalledTimes(2);
		expect(onOpen).toHaveBeenCalledWith(row);
	});

	it('marks the open card active and an archived one as archived', () => {
		render(
			<DeletedAskerListItem
				row={{
					key: 'k',
					formerSessionId: 7,
					timestamp: 0,
					archived: true
				}}
				locale="de"
				translate={translate}
				isActive
				onOpen={() => undefined}
			/>
		);

		expect(screen.getByRole('listitem').getAttribute('aria-current')).toBe(
			'true'
		);
		expect(
			screen.getByText('sessionList.deletedAsker.previewArchived')
		).toBeTruthy();
	});
});
