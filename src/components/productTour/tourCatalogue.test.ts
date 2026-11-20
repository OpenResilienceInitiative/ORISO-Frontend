import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
	audienceForUser,
	getAvailableTours,
	isConversationOpenPath,
	navTourTarget,
	orderToursForPage,
	tourAvailability,
	tourHomePath
} from './tourCatalogue';
import type { TourDefinition } from './types';
import type { UserDataInterface } from '../../globalState/interfaces';

const tour = (
	id: string,
	overrides: Partial<TourDefinition> = {}
): TourDefinition => ({
	id,
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: `${id}.title`,
	summaryKey: `${id}.summary`,
	steps: [{ id: 'one', target: '', titleKey: 't', contentKey: 'c' }],
	...overrides
});

const user = (authorities: string[]) =>
	({ grantedAuthorities: authorities }) as unknown as UserDataInterface;

describe('audienceForUser', () => {
	it('maps counsellors, askers and nobody else', () => {
		expect(
			audienceForUser(user(['AUTHORIZATION_CONSULTANT_DEFAULT']))
		).toBe('consultant');
		expect(audienceForUser(user(['AUTHORIZATION_USER_DEFAULT']))).toBe(
			'asker'
		);
		expect(
			audienceForUser(user(['AUTHORIZATION_ANONYMOUS_DEFAULT']))
		).toBeNull();
		expect(audienceForUser(undefined)).toBeNull();
	});
});

describe('getAvailableTours', () => {
	afterEach(() => {
		delete tourAvailability['gated'];
	});

	it('offers only frontend tours of the audience', () => {
		const tours = [
			tour('mine'),
			tour('asker-only', { audiences: ['asker'] }),
			tour('admin', { surface: 'admin' })
		];
		expect(
			getAvailableTours(tours, 'consultant').map(({ id }) => id)
		).toEqual(['mine']);
		expect(getAvailableTours(tours, null)).toEqual([]);
	});

	it('drops a tour whose tenant flag is off and keeps it while unset', () => {
		const flagged = tour('flagged', { when: { flag: 'featureX' } });
		expect(getAvailableTours([flagged], 'consultant')).toHaveLength(1);
		expect(
			getAvailableTours([flagged], 'consultant', {
				flags: { featureX: false }
			})
		).toHaveLength(0);
	});

	it('asks the availability registry for gates a definition cannot express', () => {
		tourAvailability['gated'] = ({ flags }) => flags?.featureY === true;
		const gated = tour('gated');
		expect(getAvailableTours([gated], 'consultant')).toHaveLength(0);
		expect(
			getAvailableTours([gated], 'consultant', {
				flags: { featureY: true }
			})
		).toHaveLength(1);
	});
});

describe('orderToursForPage', () => {
	const calendar = tour('calendar', {
		steps: [
			{ id: 'a', target: '', titleKey: 't', contentKey: 'c' },
			{
				id: 'b',
				route: '/booking/events?view=list',
				target: 'x',
				titleKey: 't',
				contentKey: 'c'
			}
		]
	});
	const profile = tour('profile', {
		steps: [
			{
				id: 'a',
				route: '/profile/allgemeines',
				target: 'x',
				titleKey: 't',
				contentKey: 'c'
			}
		]
	});

	it('reads the home page from the first routed step without its query', () => {
		expect(tourHomePath(calendar)).toBe('/booking/events');
		expect(tourHomePath(tour('none'))).toBeUndefined();
	});

	it('puts the tour of the current page first and keeps the rest in order', () => {
		const tours = [profile, calendar, tour('other')];
		expect(
			orderToursForPage(tours, '/booking/events').map(({ id }) => id)
		).toEqual(['calendar', 'profile', 'other']);
		expect(
			orderToursForPage(tours, '/profile/allgemeines/oeffentlich').map(
				({ id }) => id
			)
		).toEqual(['profile', 'calendar', 'other']);
		expect(
			orderToursForPage(tours, '/booking/eventsXYZ').map(({ id }) => id)
		).toEqual(['profile', 'calendar', 'other']);
	});
});

describe('isConversationOpenPath', () => {
	it.each([
		'/sessions/consultant/sessionView/session/42',
		'/sessions/consultant/sessionPreview/session/42',
		'/sessions/consultant/sessionView/chat/7',
		'/sessions/consultant/sessionView/!room:oriso.org/42',
		'/sessions/consultant/sessionView/!room:oriso.org/42/userProfile',
		'/sessions/user/view/session/42',
		'/sessions/user/view/chat/7',
		'/sessions/user/view/write/42',
		'/groups/7/entry'
	])('treats %s as an open conversation', (path) => {
		expect(isConversationOpenPath(path)).toBe(true);
	});

	it.each([
		'/sessions/consultant/sessionView',
		'/sessions/consultant/sessionPreview',
		'/sessions/consultant/sessionView/createGroupChat/',
		'/sessions/user/view',
		'/booking/events',
		'/profile/allgemeines',
		'/notifications'
	])('treats %s as no conversation', (path) => {
		expect(isConversationOpenPath(path)).toBe(false);
	});
});

describe('navTourTarget', () => {
	it('names every main navigation destination with a stable anchor', () => {
		expect(navTourTarget('/sessions/consultant/sessionPreview')).toBe(
			'nav-enquiries'
		);
		expect(navTourTarget('/booking/events')).toBe('nav-calendar');
		expect(navTourTarget('/notifications')).toBe('nav-activity');
		expect(navTourTarget('/sessions/user/view')).toBe('nav-sessions');
		expect(navTourTarget('/unknown')).toBeUndefined();
	});
});
