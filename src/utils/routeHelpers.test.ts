import { describe, it, expect } from 'vitest';
import {
	splitOptionalParams,
	toV7Path,
	stripPrefix,
	toV7Paths
} from './routeHelpers';

describe('splitOptionalParams', () => {
	it('returns the path unchanged when there are no optional params', () => {
		expect(splitOptionalParams('/login')).toEqual(['/login']);
		expect(
			splitOptionalParams('/sessions/user/view/session/:sessionId')
		).toEqual(['/sessions/user/view/session/:sessionId']);
	});

	it('splits a single trailing optional param, most-specific first', () => {
		expect(splitOptionalParams('/registration/:step?')).toEqual([
			'/registration/:step',
			'/registration'
		]);
	});

	it('splits two trailing optional params into three variants', () => {
		expect(
			splitOptionalParams('/sessions/user/view/:rcGroupId?/:sessionId?')
		).toEqual([
			'/sessions/user/view/:rcGroupId/:sessionId',
			'/sessions/user/view/:rcGroupId',
			'/sessions/user/view'
		]);
	});

	it('handles the topicSlug registration variant', () => {
		expect(
			splitOptionalParams('/:topicSlug/registration/:step?')
		).toEqual([
			'/:topicSlug/registration/:step',
			'/:topicSlug/registration'
		]);
	});

	it('handles a static segment before a trailing optional', () => {
		expect(
			splitOptionalParams('/sessions/user/view/write/:sessionId?')
		).toEqual([
			'/sessions/user/view/write/:sessionId',
			'/sessions/user/view/write'
		]);
	});

	it('throws on a non-trailing optional param (unsupported, positionally impossible)', () => {
		expect(() => splitOptionalParams('/a/:b?/c')).toThrow(
			/non-trailing optional param/
		);
	});
});

describe('toV7Path', () => {
	it('leaves exact routes unchanged', () => {
		expect(toV7Path('/login', true)).toBe('/login');
		expect(toV7Path('/notifications', true)).toBe('/notifications');
	});

	it('appends /* to non-exact routes', () => {
		expect(toV7Path('/profile', false)).toBe('/profile/*');
		expect(toV7Path('/booking/events', false)).toBe('/booking/events/*');
	});

	it('normalises a trailing slash before adding the splat', () => {
		expect(toV7Path('/booking/events/', false)).toBe('/booking/events/*');
	});

	it('does not double a splat that is already present', () => {
		expect(toV7Path('/profile/*', false)).toBe('/profile/*');
	});
});

describe('stripPrefix', () => {
	it('makes a path relative to a parent layout route', () => {
		expect(
			stripPrefix(
				'/sessions/consultant/sessionView/session/:sessionId',
				'/sessions/'
			)
		).toBe('consultant/sessionView/session/:sessionId');
	});

	it('drops a trailing slash', () => {
		expect(
			stripPrefix('/sessions/consultant/sessionView/', '/sessions/')
		).toBe('consultant/sessionView');
	});

	it('returns "." for the parent index path', () => {
		expect(stripPrefix('/sessions/', '/sessions/')).toBe('.');
		expect(stripPrefix('/sessions', '/sessions/')).toBe('.');
	});

	it('leaves a non-matching path alone (minus leading/trailing slashes)', () => {
		expect(stripPrefix('/profile/settings', '/sessions/')).toBe(
			'profile/settings'
		);
	});
});

describe('toV7Paths (full route-object translation)', () => {
	it('expands an exact string route to itself', () => {
		expect(toV7Paths({ path: '/login', exact: true })).toEqual(['/login']);
	});

	it('defaults exact to true when omitted', () => {
		expect(toV7Paths({ path: '/notifications' })).toEqual([
			'/notifications'
		]);
	});

	it('expands a non-exact optional-param route into splatted variants', () => {
		expect(
			toV7Paths({
				path: '/sessions/consultant/sessionPreview/:rcGroupId?/:sessionId?',
				exact: false
			})
		).toEqual([
			'/sessions/consultant/sessionPreview/:rcGroupId/:sessionId/*',
			'/sessions/consultant/sessionPreview/:rcGroupId/*',
			'/sessions/consultant/sessionPreview/*'
		]);
	});

	it('expands an array path into one entry per element', () => {
		expect(
			toV7Paths({
				path: ['/registration/:step?', '/:topicSlug/registration/:step?']
			})
		).toEqual([
			'/registration/:step',
			'/registration',
			'/:topicSlug/registration/:step',
			'/:topicSlug/registration'
		]);
	});
});
