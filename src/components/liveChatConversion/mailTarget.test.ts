import { describe, expect, it } from 'vitest';
import { mailTarget } from './mailTarget';
describe('Live Chat to mail counselling', () => {
	it('opens normal registration before an identity exists', () => {
		expect(mailTarget(null)).toBe('/registration');
	});
	it('keeps the authenticated identity after redemption', () => {
		expect(mailTarget(42)).toBe('/live-chat/convert');
	});
});
