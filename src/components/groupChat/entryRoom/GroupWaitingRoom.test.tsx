// @vitest-environment jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('lottie-web', () => ({ default: {} }));
const apiPatchUserData = vi.fn(() => Promise.resolve());
vi.mock('../../../api/apiPatchUserData', () => ({
	apiPatchUserData: (...args: unknown[]) =>
		(apiPatchUserData as (...a: unknown[]) => Promise<void>)(...args)
}));
const freshUserData = {
	dataPrivacyConfirmation: '2026-10-16T12:00:00Z',
	termsAndConditionsConfirmation: '2026-10-16T12:00:00Z'
};
const apiGetUserData = vi.fn(() => Promise.resolve(freshUserData));
vi.mock('../../../api/apiGetUserData', () => ({
	apiGetUserData: () => apiGetUserData()
}));
vi.mock('lottie-react', () => ({ default: () => null }));
/* The closing animation has its own tests. Here it only runs the swap and notes
   what the swap handed back: `false` says the person stays. */
const swapResult = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('../../transition/closing/useClosingAnimation', () => ({
	useClosingAnimation: () => ({
		play: async ({ onCovered }: { onCovered: () => unknown }) => {
			swapResult.value = await onCovered();
			return { played: true };
		}
	})
}));
/* The group's department: only a room with an agency has one. */
vi.mock('../consent/useGroupDepartment', () => ({
	useGroupDepartment: (agencyId?: number | null) =>
		agencyId
			? { status: 'ready', department: { agencyId, topicId: 3 } }
			: { status: 'ready', department: null }
}));
const DEPARTMENT_SENTENCE =
	'Ich stimme der Datenschutzerklärung der Caritas Berlin zu.';
const apiGetConsentText = vi.fn((agencyId: number, topicId: number) =>
	Promise.resolve({
		status: 'ok',
		consentText: { sentence: DEPARTMENT_SENTENCE, versionId: 4 },
		agencyId,
		topicId
	})
);
vi.mock('../../../api/apiGetConsentText', () => ({
	apiGetConsentText: (agencyId: number, topicId: number) =>
		apiGetConsentText(agencyId, topicId)
}));
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
		t: (
			_key: string,
			fallback?: string | { defaultValue?: string; agency?: string }
		) =>
			typeof fallback === 'object'
				? (fallback.defaultValue ?? _key).replace(
						'{{agency}}',
						fallback.agency ?? ''
					)
				: (fallback ?? _key),
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

const { UserDataContext } = await import(
	'../../../globalState/context/UserDataContext'
);
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
	afterEach(() => {
		cleanup();
		apiPatchUserData.mockClear();
		apiGetUserData.mockClear();
		swapResult.value = undefined;
	});
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

	/* Frank, 2026-10-17: the sheet says whom the person joins. */
	it('names the counselling centre in the consent sheet', () => {
		renderRoom(true);
		fireEvent.click(screen.getByTestId('group-entry-join'));
		const sheet = document.querySelector('[data-cy="consent-completion"]');
		expect(sheet?.textContent).toContain(
			'Diese Gruppe wird von Caritas Berlin geleitet.'
		);
	});

	/* Frank, 2026-10-16: like the live chat, "Beitreten" first slides the
	   consent into the bar; only a ticked box lets the person in, and the
	   agreement is recorded on the account on the way (ADR-022 gate 2). */
	it('asks for consent on "Beitreten" and lets the person in once agreed', async () => {
		const { onJoin } = renderRoom(true);
		const join = () => screen.getByTestId('group-entry-join');
		expect((join() as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(join());
		expect(onJoin).not.toHaveBeenCalled();
		expect(
			document.querySelector('[data-cy="consent-completion"]')
		).not.toBeNull();

		// Without the tick: no way in, the reason is shown.
		fireEvent.click(join());
		expect(onJoin).not.toHaveBeenCalled();
		expect(apiPatchUserData).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toBeTruthy();

		fireEvent.click(screen.getByRole('checkbox'));
		fireEvent.click(join());
		await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
		expect(apiPatchUserData).toHaveBeenCalledWith({
			dataPrivacyConfirmation: true,
			termsAndConditionsConfirmation: true
		});
	});

	/* The chat's own consent dialog asks when the account shows no agreement.
	   The account in memory must learn about the one just given, or the
	   person is asked a second time right after entering. */
	it('marks the agreement on the account before letting the person in', async () => {
		const setUserData = vi.fn();
		const onJoin = vi.fn();
		render(
			<UserDataContext.Provider
				value={
					{
						userData: { userName: 'eule' },
						setUserData
					} as never
				}
			>
				<GroupWaitingRoom
					topicName="Trauerbegleitung"
					agencyName="Caritas Berlin"
					plannedStart={new Date(NOW + 3 * 24 * 3600e3)}
					durationMinutes={90}
					eventId={15}
					rules={[]}
					active
					onJoin={onJoin}
					nowMs={NOW}
				/>
			</UserDataContext.Provider>
		);
		const join = () => screen.getByTestId('group-entry-join');
		fireEvent.click(join());
		fireEvent.click(screen.getByRole('checkbox'));
		fireEvent.click(join());
		await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
		expect(setUserData.mock.calls[0][0]).toMatchObject({
			userName: 'eule',
			dataPrivacyConfirmation: expect.any(String)
		});
		expect(setUserData.mock.invocationCallOrder[0]).toBeLessThan(
			onJoin.mock.invocationCallOrder[0]
		);
		// Then the real account, behind.
		await waitFor(() =>
			expect(setUserData).toHaveBeenLastCalledWith(freshUserData)
		);
		// Both agreements survive the refresh — neither is lost after joining.
		expect(setUserData.mock.lastCall?.[0]).toMatchObject({
			dataPrivacyConfirmation: expect.any(String),
			termsAndConditionsConfirmation: expect.any(String)
		});
	});

	it('records and joins once when "Beitreten" is pressed twice in a row', async () => {
		const { onJoin } = renderRoom(true);
		fireEvent.click(screen.getByTestId('group-entry-join'));
		fireEvent.click(screen.getByRole('checkbox'));
		const join = screen.getByTestId('group-entry-join');
		// Both clicks before React renders the busy state.
		act(() => {
			join.click();
			join.click();
		});
		await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
		expect(apiPatchUserData).toHaveBeenCalledTimes(1);
	});

	/* ORISO-Frontend#1737. The closing animation belongs to the press that lets
	   the person in, not to the one that only asks for consent. */
	it("declares the group chat's message field only on the press that lets the person in", () => {
		renderRoom(true);
		const join = () => screen.getByTestId('group-entry-join');
		expect(join().getAttribute('data-cy-closing')).toBeNull();
		fireEvent.click(join());
		expect(join().getAttribute('data-cy-closing')).toBe('messageField');
	});

	it('keeps the screen covered until the join request has settled', async () => {
		let settle: () => void = () => undefined;
		const pending = new Promise<void>((resolve) => {
			settle = resolve;
		});
		const { onJoin } = renderRoom(
			true,
			vi.fn(() => pending)
		);
		const join = () => screen.getByTestId('group-entry-join');
		fireEvent.click(join());
		fireEvent.click(screen.getByRole('checkbox'));
		fireEvent.click(join());

		await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
		expect(join().getAttribute('data-cy-state')).toBe('entering');
		await act(async () => settle());
		await waitFor(() =>
			expect(join().getAttribute('data-cy-state')).not.toBe('entering')
		);
		expect(swapResult.value, 'the person is on the way').not.toBe(false);
	});

	it('takes the tick back on "Ablehnen", so reopening asks again', async () => {
		const { onJoin } = renderRoom(true);
		fireEvent.click(screen.getByTestId('group-entry-join'));
		fireEvent.click(screen.getByRole('checkbox'));
		fireEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="consent-completion"]')
			).toBeNull()
		);
		fireEvent.click(screen.getByTestId('group-entry-join'));
		expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
			false
		);
		fireEvent.click(screen.getByTestId('group-entry-join'));
		expect(onJoin).not.toHaveBeenCalled();
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});

	it("asks with the group department's own sentence, then records and joins", async () => {
		const onJoin = vi.fn();
		render(
			<GroupWaitingRoom
				topicName="Trauerbegleitung"
				agencyName="Caritas Berlin"
				agencyId={7}
				plannedStart={new Date(NOW + 3 * 24 * 3600e3)}
				durationMinutes={90}
				eventId={15}
				rules={[]}
				active
				onJoin={onJoin}
				nowMs={NOW}
			/>
		);
		fireEvent.click(screen.getByTestId('group-entry-join'));
		const sheet = () =>
			document.querySelector('[data-cy="consent-completion"]');
		await waitFor(() =>
			expect(sheet()?.textContent).toContain(DEPARTMENT_SENTENCE)
		);
		expect(apiGetConsentText).toHaveBeenCalledWith(7, 3);
		fireEvent.click(screen.getByRole('checkbox'));
		fireEvent.click(screen.getByTestId('group-entry-join'));
		await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
		expect(apiPatchUserData).toHaveBeenCalledTimes(1);
	});

	it('stays outside when the agreement cannot be saved', async () => {
		apiPatchUserData.mockImplementationOnce(() =>
			Promise.reject(new Error('down'))
		);
		const { onJoin } = renderRoom(true);
		fireEvent.click(screen.getByTestId('group-entry-join'));
		fireEvent.click(screen.getByRole('checkbox'));
		fireEvent.click(screen.getByTestId('group-entry-join'));
		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect(onJoin).not.toHaveBeenCalled();
		expect(
			swapResult.value,
			'the closing animation is told the person stays'
		).toBe(false);
	});

	it('tells the closing animation the person stays when the join request fails', async () => {
		const { onJoin } = renderRoom(
			true,
			vi.fn(() => Promise.reject(new Error('join failed')))
		);
		const join = () => screen.getByTestId('group-entry-join');
		fireEvent.click(join());
		fireEvent.click(screen.getByRole('checkbox'));
		fireEvent.click(join());

		await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(swapResult.value).toBe(false));
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
