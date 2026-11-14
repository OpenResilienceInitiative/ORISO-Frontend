// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarSidebar, QuickEntry } from './CalendarSidebar';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

// Monday 16 November 2026, 09:50.
const NOW = new Date(2026, 10, 16, 9, 50);
const CONVERSATIONS = [
	{ sessionId: 4401, username: 'ruhiges_yak' },
	{ sessionId: 4402, username: 'mutige_eule' }
];

const open = (onCreate: React.ComponentProps<typeof QuickEntry>['onCreate']) =>
	render(
		<QuickEntry
			ownerId="me"
			now={NOW}
			entries={[]}
			conversations={CONVERSATIONS}
			workingHours={[]}
			onCreate={onCreate}
		/>
	);

const input = () =>
	document.querySelector<HTMLInputElement>(
		'[data-cy="calendar-quick-input"]'
	) as HTMLInputElement;
const submit = () =>
	act(async () => {
		fireEvent.submit(input().form as HTMLFormElement);
	});

describe('QuickEntry — the draft until it is created (review 4574775715)', () => {
	it('keeps the line when creating fails', async () => {
		const onCreate = vi.fn(() => Promise.reject(new Error('500')));
		open(onCreate);
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		await submit();
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(input().value).toBe('morgen 14 Uhr Video ruhiges');
	});

	it('clears the line once the entry exists', async () => {
		open(() => Promise.resolve());
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		await submit();
		expect(input().value).toBe('');
	});
});

describe('QuickEntry — conversation named in the line (review 4574779936)', () => {
	it('replaces an earlier pick with the conversation the line names', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		open(onCreate);
		fireEvent.change(input(), { target: { value: 'morgen 14 Uhr Video' } });
		fireEvent.click(screen.getByText('ruhiges_yak'));
		fireEvent.change(input(), {
			target: { value: 'morgen 14 Uhr Video mutige' }
		});
		await submit();
		expect(onCreate).toHaveBeenCalledWith([
			expect.objectContaining({ sessionId: 4402 })
		]);
	});

	it('keeps the pick while the line names nobody', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		open(onCreate);
		fireEvent.change(input(), { target: { value: 'morgen 14 Uhr Video' } });
		fireEvent.click(screen.getByText('ruhiges_yak'));
		fireEvent.change(input(), { target: { value: 'morgen 15 Uhr Video' } });
		await submit();
		expect(onCreate).toHaveBeenCalledWith([
			expect.objectContaining({ sessionId: 4401 })
		]);
	});
});

describe('CalendarSidebar — folding quick entry on the phone (review 4574981879)', () => {
	const sidebar = (quickOpen: boolean) => (
		<CalendarSidebar
			ownerId="me"
			consultant
			now={NOW}
			entries={[]}
			colleagues={[]}
			conversations={CONVERSATIONS}
			workingHours={[]}
			onlyFacets={[]}
			hiddenFacets={[]}
			onToggleFacet={() => undefined}
			onHighlightFacet={() => undefined}
			kindsMenuOpen={false}
			onOpenKinds={() => undefined}
			openProposals={[]}
			onOpenEntry={() => undefined}
			shownColleagues={[]}
			onCreate={() => undefined}
			variant="sheet"
			quickOpen={quickOpen}
			onQuickToggle={() => undefined}
		/>
	);

	it('keeps the draft when quick entry is folded and opened again', () => {
		const { rerender } = render(sidebar(true));
		fireEvent.change(input(), { target: { value: 'morgen 14 Uhr' } });
		rerender(sidebar(false));
		expect(
			(document.getElementById('calendar-quick-panel') as HTMLElement)
				.hidden
		).toBe(true);
		rerender(sidebar(true));
		expect(input().value).toBe('morgen 14 Uhr');
	});
});
