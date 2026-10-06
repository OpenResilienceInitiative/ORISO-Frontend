// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
	MemoryRouter,
	useLocation,
	useNavigate,
	type NavigateFunction
} from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../globalState/context/UserDataContext';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import { usePracticeSandbox } from './PracticeSandbox';
import { PracticeProvider } from './PracticeProvider';
import {
	endPractice,
	enterPracticeMode,
	exitPracticeMode,
	getPracticeSnapshot
} from './practiceMode';
import {
	practiceAcceptedSessionRoute,
	practiceEnquirySessionRoute,
	PRACTICE_ENQUIRIES_ROUTE
} from './practiceRoutes';
import { PracticeSurface } from './PracticeSurface';
import { createPracticeTestI18n } from './script/scriptTestSupport';

const ACCEPT = 'consultant-practice-accept';
const HELP_ROUTE = '/profile/hilfe/rundgaenge';

/** "practice world" inside the sandbox, "real app" outside. */
const Content = () => {
	let inSandbox = true;
	try {
		usePracticeSandbox();
	} catch {
		inSandbox = false;
	}
	return inSandbox ? (
		<p data-testid="practice-world">practice world</p>
	) : (
		<p>real app</p>
	);
};

let navigateTo: NavigateFunction = () => undefined;
const Location = () => {
	const { pathname } = useLocation();
	navigateTo = useNavigate();
	return <output data-testid="route">{pathname}</output>;
};
const route = () => screen.getByTestId('route').textContent;

const settle = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const renderSurface = (at = HELP_ROUTE) =>
	render(
		<I18nextProvider i18n={createPracticeTestI18n('de')}>
			<PracticeProvider>
				<UserDataContext.Provider
					value={{
						userData: practiceCounsellorFixture(),
						setUserData: vi.fn()
					}}
				>
					<MemoryRouter initialEntries={[at]}>
						<Location />
						<PracticeSurface>
							<Content />
						</PracticeSurface>
					</MemoryRouter>
				</UserDataContext.Provider>
			</PracticeProvider>
		</I18nextProvider>
	);

beforeEach(() => {
	window.fetch = vi.fn(
		async () => new Response('{}', { status: 200 })
	) as typeof window.fetch;
});

afterEach(async () => {
	cleanup();
	await settle();
	exitPracticeMode();
});

describe('PracticeSurface', () => {
	it('renders its children untouched while practice is off', () => {
		renderSurface();

		expect(screen.getByText('real app')).toBeTruthy();
		expect(screen.queryByTestId('practice-world')).toBeNull();
	});

	it('runs its children on the practice world only while practice is active', () => {
		renderSurface();

		act(() => enterPracticeMode({ tourId: ACCEPT }));

		expect(screen.getByTestId('practice-world')).toBeTruthy();
		expect(screen.queryByText('real app')).toBeNull();
	});

	it('renders nothing while closing, so no real view mounts under the guard, and the real content after the exit', async () => {
		renderSurface();
		act(() => enterPracticeMode({ tourId: ACCEPT }));

		let ended: Promise<void> = Promise.resolve();
		act(() => {
			ended = endPractice();
		});

		expect(getPracticeSnapshot().status).toBe('closing');
		expect(screen.queryByTestId('practice-world')).toBeNull();
		expect(screen.queryByText('real app')).toBeNull();

		await act(() => ended);

		expect(getPracticeSnapshot().status).toBe('inactive');
		expect(screen.getByText('real app')).toBeTruthy();
	});

	it('returns to where practice was started when it ends', async () => {
		renderSurface();
		act(() => enterPracticeMode({ tourId: ACCEPT }));
		act(() => navigateTo(practiceAcceptedSessionRoute()));

		let ended: Promise<void> = Promise.resolve();
		act(() => {
			ended = endPractice();
		});
		await act(() => ended);

		expect(route()).toBe(HELP_ROUTE);
		expect(screen.getByText('real app')).toBeTruthy();
	});

	it('keeps its start location across a restart (end + enter in one go)', async () => {
		renderSurface();
		act(() => enterPracticeMode({ tourId: ACCEPT }));
		act(() => navigateTo(PRACTICE_ENQUIRIES_ROUTE));

		act(() => {
			void endPractice();
			enterPracticeMode({ tourId: ACCEPT });
		});
		await settle();
		let ended: Promise<void> = Promise.resolve();
		act(() => {
			ended = endPractice();
		});
		await act(() => ended);

		expect(route()).toBe(HELP_ROUTE);
	});

	it('never opens a real case while practising: a real session route leads to the practice enquiries', () => {
		renderSurface();
		act(() => enterPracticeMode({ tourId: ACCEPT }));

		act(() => navigateTo('/sessions/consultant/sessionView/session/4711'));
		expect(route()).toBe(PRACTICE_ENQUIRIES_ROUTE);

		act(() =>
			navigateTo(
				'/sessions/consultant/sessionView/!abc:matrix.example.org/4711'
			)
		);
		expect(route()).toBe(PRACTICE_ENQUIRIES_ROUTE);

		act(() => navigateTo(practiceEnquirySessionRoute()));
		expect(route()).toBe(practiceEnquirySessionRoute());
	});

	it('never opens a practice case outside practice (for example Back after the end)', () => {
		renderSurface(practiceAcceptedSessionRoute());

		expect(route()).toBe(PRACTICE_ENQUIRIES_ROUTE);
		expect(screen.getByText('real app')).toBeTruthy();
	});
});
