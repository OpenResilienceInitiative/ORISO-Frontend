// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fetchData } from '../api/fetchData';
import { apiGetAddonRegistry } from './addonRegistryApi';
import {
	apiGetAddonCalendar,
	parseAddonCalendar,
	useAddonCalendarEntries
} from './addonCalendar';
import { AddonCalendarPill } from './AddonCalendarPill';
import {
	resetAddonRegistryForTests,
	useAddonRegistryLoader
} from './addonRegistry';
import { AvailableAddon } from './addonTypes';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options?.title ? `${key}:${options.title}` : key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

vi.mock('../api/fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../api/fetchData')>()),
	fetchData: vi.fn()
}));

vi.mock('./addonRegistryApi', () => ({
	apiGetAddonRegistry: vi.fn()
}));

const tools: AvailableAddon = {
	name: 'digisucht-tools',
	version: '1.0.0',
	entry: '/e.js',
	apiBase: '/api',
	apps: [
		{
			id: 'goals',
			title: { de: 'Ziele', en: 'Goals' },
			slots: ['asker.navigation']
		}
	]
};

const rawEntry = {
	id: 'g-1',
	addon: 'digisucht-tools',
	appId: 'goals',
	kind: 'deadline',
	title: { de: 'Ziele überprüfen', en: 'Review goals' },
	start: '2026-11-20T09:00:00Z',
	link: { slot: 'asker.navigation' }
};

describe('parseAddonCalendar', () => {
	it('keeps valid entries sorted by start and drops broken ones', () => {
		const entries = parseAddonCalendar({
			entries: [
				rawEntry,
				{ ...rawEntry, id: 2, start: '2026-11-19T09:00:00Z' },
				{ ...rawEntry, id: 'no-start', start: 'tomorrow' },
				{ ...rawEntry, id: 'no-title', title: {} },
				{ ...rawEntry, id: 'no-addon', addon: undefined },
				'nonsense'
			],
			errors: ['other-addon']
		});
		expect(entries.map((entry) => entry.id)).toEqual(['2', 'g-1']);
		expect(entries[1]).toMatchObject({
			kind: 'deadline',
			allDay: false,
			end: undefined,
			link: {
				addon: 'digisucht-tools',
				appId: 'goals',
				slot: 'asker.navigation',
				sessionId: null
			}
		});
	});

	it('gives all-day entries the whole day and unknown kinds the appointment kind', () => {
		const [entry] = parseAddonCalendar({
			entries: [{ ...rawEntry, kind: 'party', allDay: true }]
		});
		expect(entry.kind).toBe('appointment');
		expect(entry.end?.toISOString()).toBe('2026-11-21T09:00:00.000Z');
	});

	it('returns nothing for an unexpected response', () => {
		expect(parseAddonCalendar(null)).toEqual([]);
		expect(parseAddonCalendar({ entries: 'x' })).toEqual([]);
	});
});

describe('apiGetAddonCalendar', () => {
	afterEach(() => vi.mocked(fetchData).mockReset());

	it('asks for the range and ignores errors', async () => {
		vi.mocked(fetchData).mockResolvedValueOnce({ entries: [rawEntry] });
		const from = new Date('2026-11-12T00:00:00Z');
		const to = new Date('2027-02-12T00:00:00Z');
		const entries = await apiGetAddonCalendar(from, to);
		expect(entries).toHaveLength(1);
		const { url } = vi.mocked(fetchData).mock.calls[0][0];
		expect(url).toContain('/service/addons/calendar?');
		expect(url).toContain('from=2026-11-12T00%3A00%3A00.000Z');
		expect(url).toContain('to=2027-02-12T00%3A00%3A00.000Z');

		vi.mocked(fetchData).mockRejectedValueOnce(new Error('503'));
		await expect(apiGetAddonCalendar(from, to)).resolves.toEqual([]);
	});
});

describe('useAddonCalendarEntries', () => {
	afterEach(cleanup);
	beforeEach(() => {
		resetAddonRegistryForTests();
		vi.mocked(fetchData).mockReset();
		vi.mocked(fetchData).mockResolvedValue({ entries: [rawEntry] });
	});

	const useCalendar = (enabled: boolean) => {
		useAddonRegistryLoader('u1');
		return useAddonCalendarEntries({ enabled, monthsAhead: 3 });
	};

	it('loads entries once the user has add-ons', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([tools]);
		const { result } = renderHook(() => useCalendar(true));
		await waitFor(() => expect(result.current).toHaveLength(1));
	});

	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

	it('asks for at most 92 days', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([tools]);
		renderHook(() => {
			useAddonRegistryLoader('u1');
			return useAddonCalendarEntries({ enabled: true, monthsAhead: 12 });
		});
		await waitFor(() => expect(vi.mocked(fetchData)).toHaveBeenCalled());
		const query = new URLSearchParams(
			vi.mocked(fetchData).mock.calls[0][0].url.split('?')[1]
		);
		const days =
			(Date.parse(query.get('to') ?? '') -
				Date.parse(query.get('from') ?? '')) /
			(24 * 60 * 60 * 1000);
		expect(days).toBe(92);
	});

	it('does not call the AddonService without add-ons', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([]);
		renderHook(() => useCalendar(true));
		await waitFor(() =>
			expect(vi.mocked(apiGetAddonRegistry)).toHaveBeenCalled()
		);
		await flush();
		expect(vi.mocked(fetchData)).not.toHaveBeenCalled();
	});

	it('does not call the AddonService when the view is off', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([tools]);
		renderHook(() => useCalendar(false));
		await flush();
		expect(vi.mocked(fetchData)).not.toHaveBeenCalled();
	});
});

describe('AddonCalendarPill', () => {
	const Location = () => (
		<span data-testid="path">{useLocation().pathname}</span>
	);

	it('shows the entry with its add-on app and opens the link target', async () => {
		vi.mocked(apiGetAddonRegistry).mockResolvedValue([tools]);
		const [entry] = parseAddonCalendar({ entries: [rawEntry] });
		const Pill = () => {
			useAddonRegistryLoader('u1');
			return (
				<AddonCalendarPill
					entry={entry}
					now={new Date('2026-11-12T10:00:00Z')}
					sessionsBasePath="/sessions/user/view"
				/>
			);
		};
		render(
			<MemoryRouter initialEntries={['/sessions/user/view']}>
				<Routes>
					<Route path="*" element={<Pill />} />
				</Routes>
				<Location />
			</MemoryRouter>
		);
		await screen.findByText('Ziele');
		expect(screen.getByText('Ziele überprüfen')).toBeTruthy();
		const pill = screen.getByRole('button');
		expect(pill.getAttribute('title')).toBe('addons.calendar.source:Ziele');
		fireEvent.click(pill);
		expect(screen.getByTestId('path').textContent).toBe(
			'/addons/digisucht-tools/goals'
		);
	});
});
