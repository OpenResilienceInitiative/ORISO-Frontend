// @vitest-environment jsdom
/**
 * #993 — an empty @-mention popup used to render nothing at all, so "nobody
 * matches" and "the directory never loaded" were the same silent blank. These
 * tests hold each cause to its own visible message.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MentionList } from './MentionList';
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
			screen.getByRole('option', { name: /M\. Musterfrau/ })
		).toBeTruthy();
		expect(screen.queryByText('Niemand gefunden')).toBeNull();
	});

	it('flags a consultant who is not in the chat but still offers them', () => {
		renderList([{ ...candidate, isInRoom: false }], 'ready');

		const option = screen.getByRole('option', { name: /M\. Musterfrau/ });
		expect(option.textContent).toContain('nicht im Chat');
	});
});
