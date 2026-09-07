// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../stage/stage', () => ({ Stage: () => null }));
vi.mock('../../stageLayout/StageLayout', () => ({
	StageLayout: ({
		children,
		headerStart
	}: {
		children: React.ReactNode;
		headerStart?: React.ReactNode;
	}) => (
		<main>
			<header data-testid="header-start">{headerStart}</header>
			{children}
		</main>
	)
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

const { GroupWaitingRoom, entryRoomClockHeight } = await import(
	'./GroupWaitingRoom'
);

const NOW = Date.UTC(2026, 8, 4, 14, 0, 0);
const renderRoom = (active: boolean, onJoin = vi.fn()) => {
	const view = render(
		<GroupWaitingRoom
			topicName="Trauerbegleitung"
			agencyName="Caritas Berlin"
			plannedStart={new Date(NOW + 3 * 24 * 3600e3)}
			durationMinutes={90}
			eventId={15}
			welcomeText="Schön, dass Sie da sind."
			rules={['Was hier gesagt wird, bleibt hier.']}
			active={active}
			onJoin={onJoin}
			nowMs={NOW}
		/>
	);
	return Object.assign(view, { onJoin });
};

describe('GroupWaitingRoom', () => {
	afterEach(cleanup);
	it('names topic and agency in the stage header', () => {
		renderRoom(false);
		const header = screen.getByTestId('header-start');
		expect(header.textContent).toContain('Trauerbegleitung');
		expect(header.textContent).toContain('Caritas Berlin');
	});

	it('keeps topic and agency on their own lines, never dash-joined', () => {
		renderRoom(false);
		// Both strings come from the API. A dash coded between them reads as
		// part of the agency's name as soon as one of the two is missing.
		const header = screen.getByTestId('header-start');
		expect(header.textContent).not.toMatch(/[\u2013\u2014]/);
		expect(header.textContent).toBe('TrauerbegleitungCaritas Berlin');
	});

	it('shows "Beitreten" shut until the moderator opens the group', () => {
		const { onJoin } = renderRoom(false);
		const join = screen.getByTestId('group-entry-join');
		expect((join as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(join);
		expect(onJoin).not.toHaveBeenCalled();
	});

	it('lets the person in once the group is open', () => {
		const { onJoin } = renderRoom(true);
		const join = screen.getByTestId('group-entry-join');
		expect((join as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(join);
		expect(onJoin).toHaveBeenCalledTimes(1);
	});

	it('puts the explainer in the middle and the clock back on return', async () => {
		const { container } = renderRoom(false);
		const gallery = () =>
			container.querySelector('[data-cy="group-info-gallery"]');
		expect(gallery()).toBeNull();

		fireEvent.click(screen.getByTestId('group-entry-more'));
		/* Only the middle changes: the explainer stands where the clock
		   stood, and the bar with "Beitreten" stays. */
		expect(gallery()).toBeTruthy();
		expect(screen.queryByTestId('group-entry-more')).toBeNull();
		expect(screen.getByTestId('group-entry-join')).toBeTruthy();

		fireEvent.click(screen.getByTestId('group-info-back'));
		await waitFor(() => expect(gallery()).toBeNull());
		expect(screen.getByTestId('group-entry-more')).toBeTruthy();
	});

	it('parks "Mehr erfahren" as the small control of the row', () => {
		renderRoom(false);
		const more = screen.getByTestId('group-entry-more');
		expect(more.className).toContain('MuiButton-sizeSmall');
		expect(more.className).toContain('MuiButton-outlined');
	});
});

describe('entryRoomClockHeight', () => {
	/*
	 * The budget the clock is handed. Every number is a band measured on the
	 * two review viewports; if one of them moves, this is where it is written
	 * down — and where a scrollbar starts if it is written down wrong.
	 */
	it('leaves the clock 600 px on the 1440 x 950 desktop story', () => {
		expect(entryRoomClockHeight(1440, 950)).toBe(600);
	});

	it('leaves the clock 435 px on the 375 x 812 phone story', () => {
		expect(entryRoomClockHeight(375, 812)).toBe(435);
	});

	it('reserves more below the stage split, where the group block and the taller headline stand in the column', () => {
		expect(entryRoomClockHeight(1199, 950)).toBeLessThan(
			entryRoomClockHeight(1200, 950)
		);
	});

	it('never asks for a negative clock on a tiny window', () => {
		expect(entryRoomClockHeight(320, 400)).toBe(160);
	});
});
