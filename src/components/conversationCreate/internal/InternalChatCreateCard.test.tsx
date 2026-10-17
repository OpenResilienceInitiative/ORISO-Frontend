// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InternalChatCreateCard } from './InternalChatCreateCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock(
	'../../../resources/img/illustrations/conversation/internal-team.png',
	() => ({ default: 'internal-team.png' })
);

const people = Array.from({ length: 52 }, (_, index) => ({
	id: `p-${index}`,
	label: `Person ${index}`
}));

const renderCard = (
	props: Partial<React.ComponentProps<typeof InternalChatCreateCard>> = {}
) =>
	render(
		<InternalChatCreateCard
			people={people.slice(0, 3)}
			draft={{ name: 'Fallbesprechung', selectedIds: ['p-0'] }}
			onDraftChange={vi.fn()}
			onCreate={vi.fn()}
			{...props}
		/>
	);

const createButton = () =>
	screen.getByRole('button', { name: 'groupChat.internal.createLabel' });

describe('InternalChatCreateCard (#1772)', () => {
	afterEach(cleanup);

	it('adds nobody to the selection: the create button is ready with exactly one picked colleague', () => {
		const onCreate = vi.fn();
		renderCard({ onCreate });

		expect((createButton() as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(createButton());
		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it.each(['AGENCY', 'TENANT', 'PLATFORM'] as const)(
		'names the scope %s next to the picker',
		(scope) => {
			renderCard({ scope });
			expect(
				screen.getByText(`groupChat.internal.scope.${scope}`, {
					exact: false
				})
			).toBeTruthy();
		}
	);

	it('defaults to the counselling centre', () => {
		renderCard();
		expect(
			screen.getByText('groupChat.internal.scope.AGENCY', {
				exact: false
			})
		).toBeTruthy();
	});

	it('announces a refusal as an alert', () => {
		renderCard({ errorMessage: 'Es wurde nichts erstellt.' });
		expect(screen.getByRole('alert').textContent).toBe(
			'Es wurde nichts erstellt.'
		);
	});

	it('does not allow more colleagues than the room can hold', () => {
		renderCard({
			people,
			draft: {
				name: 'Fallbesprechung',
				selectedIds: people.slice(0, 51).map((person) => person.id)
			}
		});

		expect((createButton() as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByRole('alert').textContent).toBe(
			'groupChat.internal.tooMany'
		);
	});

	it('says that nobody is available instead of opening an empty frame', () => {
		renderCard({
			people: [],
			draft: { name: '', selectedIds: [] }
		});

		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.internal.addPerson'
			})
		);

		expect(
			screen.getByText('groupChat.internal.noColleagues')
		).toBeTruthy();
	});
});
