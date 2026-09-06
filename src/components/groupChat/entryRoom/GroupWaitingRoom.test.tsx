// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

const { GroupWaitingRoom } = await import('./GroupWaitingRoom');

const NOW = Date.UTC(2026, 8, 4, 14, 0, 0);
const renderRoom = (active: boolean, onJoin = vi.fn()) => {
	render(
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
	return onJoin;
};

describe('GroupWaitingRoom', () => {
	afterEach(cleanup);
	it('names topic and agency in the stage header', () => {
		renderRoom(false);
		const header = screen.getByTestId('header-start');
		expect(header.textContent).toContain('Trauerbegleitung');
		expect(header.textContent).toContain('Caritas Berlin');
	});

	it('shows "Beitreten" shut until the moderator opens the group', () => {
		const onJoin = renderRoom(false);
		const join = screen.getByTestId('group-entry-join');
		expect((join as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(join);
		expect(onJoin).not.toHaveBeenCalled();
	});

	it('lets the person in once the group is open', () => {
		const onJoin = renderRoom(true);
		const join = screen.getByTestId('group-entry-join');
		expect((join as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(join);
		expect(onJoin).toHaveBeenCalledTimes(1);
	});

	it('opens the greeting and the rules behind "Mehr erfahren"', () => {
		renderRoom(false);
		fireEvent.click(screen.getByTestId('group-entry-more'));
		const dialog = screen.getByRole('dialog');
		expect(dialog.textContent).toContain('Schön, dass Sie da sind.');
		expect(dialog.textContent).toContain(
			'Was hier gesagt wird, bleibt hier.'
		);
	});
});
