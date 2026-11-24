import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { UserDataContext } from '../../globalState';
import { CalendarPageWired } from './CalendarPageWired';

/**
 * #2523: "Meine Termine" for an advice seeker, wired. The backend sends
 * `agencies: null` for advice seekers; the page used to throw on it and show
 * the error page instead of the calendar.
 */
const SEEKER = {
	userId: 'seeker-1',
	userName: 'katze_mika_1234',
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
	userRoles: ['user'],
	agencies: null
};

/* The advice seeker's calendar requests, answered empty. Anything else
   falls through to the global stand-in, which reports it as unexpected. */
const EMPTY_ANSWERS: [RegExp, unknown][] = [
	[/\/service\/users\/calendar\/entries\b/, []],
	[/\/service\/users\/calendar\/proposals\b/, { sent: [], received: [] }],
	[
		/\/service\/users\/calendar\/sync\b/,
		{ feedUrl: '', importConfigured: false }
	],
	[/\/service\/users\/calendar\/working-hours\b/, { windows: [] }],
	[/\/service\/users\/calendar\/consultation-hours\/once\b/, []],
	[/\/service\/users\/calendar\/consultation-hours\b/, { windows: [] }],
	[/\/service\/users\/sessions\/askers\b/, { sessions: [] }]
];

const answerSeekerCalendar = () => {
	const previous = globalThis.fetch;
	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input);
		const match = EMPTY_ANSWERS.find(([pattern]) => pattern.test(url));
		if (match)
			return new Response(JSON.stringify(match[1]), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		return previous(input, init);
	};
	return () => {
		globalThis.fetch = previous;
	};
};

const meta: Meta<typeof CalendarPageWired> = {
	title: 'Templates/Calendar/Meine Termine/Wired (advice seeker)',
	component: CalendarPageWired,
	globals: { locale: 'de' },
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/booking/events' }
	},
	beforeEach: answerSeekerCalendar,
	decorators: [
		(Story) => (
			<UserDataContext.Provider
				value={
					{
						userData: SEEKER,
						setUserData: () => undefined,
						reloadUserData: async () => null
					} as never
				}
			>
				<Story />
			</UserDataContext.Provider>
		)
	]
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The calendar opens; no error page. */
export const AgenciesNull: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByTestId('calendar-view')).toBeTruthy();
	}
};
