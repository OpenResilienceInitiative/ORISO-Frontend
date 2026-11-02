// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { GroupChatInfoM3 } from './GroupChatInfoM3';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const renderList = (
	participants: React.ComponentProps<typeof GroupChatInfoM3>['participants']
) =>
	render(
		<GroupChatInfoM3
			topic="Gruppe"
			settings={[]}
			participants={participants}
		/>
	);

/** OBP 2.1 #107 "Alle sehen alle Rollen". */
describe('GroupChatInfoM3 participant role badges', () => {
	afterEach(cleanup);

	it.each([
		['Ratsuchende:r', 'Anna'],
		['Berater:in', 'Bea'],
		['Supervisor:in', 'Clara']
	])('shows the badge "%s" next to the participant', (roleLabel, name) => {
		renderList([{ id: '@x:hs', name, roleLabel }]);

		const row = screen.getByText(name).closest('li') as HTMLElement;
		expect(within(row).getByText(roleLabel)).toBeTruthy();
	});

	it('shows no badge while the role is unknown', () => {
		renderList([{ id: '@x:hs', name: 'Dora' }]);

		const row = screen.getByText('Dora').closest('li') as HTMLElement;
		expect(row.querySelector('[data-cy="participant-role"]')).toBeNull();
	});

	it('keeps the ban state readable next to the badge', () => {
		renderList([
			{
				id: '@x:hs',
				name: 'Emil',
				roleLabel: 'Ratsuchende:r',
				statusLabel: 'Gebannt'
			}
		]);

		const row = screen.getByText('Emil').closest('li') as HTMLElement;
		expect(within(row).getByText('Ratsuchende:r')).toBeTruthy();
		expect(within(row).getByText('Gebannt')).toBeTruthy();
	});
});
