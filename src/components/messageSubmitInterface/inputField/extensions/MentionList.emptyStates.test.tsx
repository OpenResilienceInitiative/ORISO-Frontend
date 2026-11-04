// @vitest-environment oriso-jsdom
/**
 * #993 — an empty @-mention popup used to render nothing at all, so "nobody
 * matches" and "the directory never loaded" were the same silent blank. These
 * tests hold each cause to its own visible message.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { MentionList, MentionListRef } from './MentionList';
import type { MentionCandidate } from './mentionFiltering';

afterEach(() => cleanup());

const labels = {
	notInChatLabel: 'nicht im Chat',
	emptyLabel: 'Niemand gefunden',
	unavailableLabel: 'Liste konnte nicht geladen werden',
	loadingLabel: 'Wird geladen …'
};

const candidate: MentionCandidate = {
	id: 'consultant-1',
	displayName: 'M. Musterfrau',
	username: 'musterfrau',
	isInRoom: true
};

const renderList = (
	items: MentionCandidate[],
	directoryState: 'loading' | 'ready' | 'error' | 'unavailable' = 'ready'
) =>
	render(
		<MentionList
			items={items}
			command={vi.fn()}
			directoryState={directoryState}
			// eslint-disable-next-line react/jsx-props-no-spreading
			{...labels}
		/>
	);

describe('MentionList empty states (#993)', () => {
	it('says the directory could not be loaded when the request failed', () => {
		renderList([], 'error');

		expect(
			screen.getByText('Liste konnte nicht geladen werden')
		).toBeTruthy();
	});

	it('distinguishes "nobody matches" from a failed request', () => {
		renderList([], 'ready');

		expect(screen.getByText('Niemand gefunden')).toBeTruthy();
		expect(
			screen.queryByText('Liste konnte nicht geladen werden')
		).toBeNull();
	});

	it('shows a loading state while the directory is still on its way', () => {
		renderList([], 'loading');

		expect(screen.getByText('Wird geladen …')).toBeTruthy();
	});

	it('stays silent where mentions do not apply at all', () => {
		const { container } = renderList([], 'unavailable');

		expect(container.firstChild).toBeNull();
	});

	it('shows candidates rather than a status once the directory has them', () => {
		renderList([candidate], 'ready');

		expect(
			screen.getByRole('button', { name: /M\. Musterfrau/ })
		).toBeTruthy();
		expect(screen.queryByText('Niemand gefunden')).toBeNull();
	});

	it('flags a consultant who is not in the chat but still offers them', () => {
		renderList([{ ...candidate, isInRoom: false }], 'ready');

		const option = screen.getByRole('button', { name: /M\. Musterfrau/ });
		expect(option.textContent).toContain('nicht im Chat');
	});
});

describe('MentionList Enter on an empty list', () => {
	const pressEnter = (
		directoryState: 'loading' | 'ready' | 'unavailable'
	): boolean => {
		const ref = React.createRef<MentionListRef>();
		render(
			<MentionList
				ref={ref}
				items={[]}
				command={vi.fn()}
				directoryState={directoryState}
				// eslint-disable-next-line react/jsx-props-no-spreading
				{...labels}
			/>
		);
		return (
			ref.current?.onKeyDown(
				new KeyboardEvent('keydown', { key: 'Enter' })
			) ?? false
		);
	};

	it('holds Enter while the list is loading, so nothing half-typed is sent', () => {
		expect(pressEnter('loading')).toBe(true);
	});

	it('lets Enter through once nobody can be picked', () => {
		expect(pressEnter('ready')).toBe(false);
		cleanup();
		expect(pressEnter('unavailable')).toBe(false);
	});
});

describe('MentionList with several people', () => {
	const other: MentionCandidate = {
		...candidate,
		id: 'c-2',
		displayName: 'A. Krüger',
		username: 'a.krueger'
	};
	const renderPicker = (items: MentionCandidate[]) => {
		const command = vi.fn();
		const commandMany = vi.fn();
		const props = { command, commandMany, notInChatLabel: 'nicht im Chat' };
		const view = render(<MentionList items={items} {...props} />);
		return {
			command,
			commandMany,
			search: (next: MentionCandidate[]) =>
				view.rerender(<MentionList items={next} {...props} />)
		};
	};

	it('still inserts one person at once when a name is clicked', () => {
		const { command, commandMany } = renderPicker([candidate, other]);

		fireEvent.click(screen.getByRole('button', { name: /Krüger/ }));

		expect(command).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'c-2' })
		);
		expect(commandMany).not.toHaveBeenCalled();
	});

	it('keeps a ticked person on top while the search no longer matches', () => {
		const { search } = renderPicker([candidate, other]);

		fireEvent.click(screen.getAllByRole('checkbox')[1]);
		search([candidate]);

		const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
		expect(boxes).toHaveLength(2);
		expect(boxes[0].checked).toBe(true);
		expect(screen.getAllByRole('button')[0].textContent).toContain(
			'Krüger'
		);
	});

	it('inserts the ticked people together with a clicked name', () => {
		const { command, commandMany } = renderPicker([candidate, other]);

		fireEvent.click(screen.getAllByRole('checkbox')[1]);
		fireEvent.click(screen.getByRole('button', { name: /Musterfrau/ }));

		expect(
			commandMany.mock.calls[0][0].map((p: { id: string }) => p.id)
		).toEqual(['c-2', candidate.id]);
		expect(command).not.toHaveBeenCalled();
	});
});
