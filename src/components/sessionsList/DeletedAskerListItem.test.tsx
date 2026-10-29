// @vitest-environment oriso-jsdom
import * as React from 'react';
import { describe, expect, it } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { DeletedAskerListItem } from './DeletedAskerListItem';

const translate = (key: string) =>
	({
		'sessionList.deletedAsker.title': 'Gelöschte:r Ratsuchende:r',
		'sessionList.deletedAsker.hint':
			'Dieser Chat wurde gelöscht. Persönliche Daten und Nachrichten sind nicht mehr verfügbar.'
	})[key] ?? key;

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

	it('is inert: no link, no button, nothing to focus', () => {
		const { container } = render(
			<DeletedAskerListItem
				row={{ key: 'k', formerSessionId: 7, timestamp: 0 }}
				locale="de"
				translate={translate}
			/>
		);

		expect(container.querySelector('a, button, [tabindex]')).toBeNull();
		expect(
			container
				.querySelector('.sessionsListDeletedAskerItem')
				?.getAttribute('aria-disabled')
		).toBe('true');
	});
});
