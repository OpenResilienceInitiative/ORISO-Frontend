import { describe, expect, it } from 'vitest';
import { toSameOriginRoute } from './stageLayoutRoutes';

describe('toSameOriginRoute', () => {
	const origin = 'https://app.oriso-dev.site';

	it('converts same-origin absolute URLs into client routes', () => {
		expect(
			toSameOriginRoute(
				'https://app.oriso-dev.site/login?tenant=oriso#top',
				origin
			)
		).toBe('/login?tenant=oriso#top');
	});

	it('keeps relative app routes usable by React Router', () => {
		expect(toSameOriginRoute('/registration', origin)).toBe(
			'/registration'
		);
	});

	it('rejects external origins so links can fall back to document navigation', () => {
		expect(
			toSameOriginRoute('https://auth.oriso-dev.site/login', origin)
		).toBe(null);
	});
});
