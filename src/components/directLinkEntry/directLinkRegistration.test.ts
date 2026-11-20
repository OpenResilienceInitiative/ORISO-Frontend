// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { directLinkRegistration } from './directLinkRegistration';

vi.mock('../registration/autoLogin', () => ({ redirectToApp: vi.fn() }));

const context = (temporaryAccount: boolean) =>
	({
		tenantId: 1,
		agencyId: 7,
		consultingTypeId: 3,
		topicId: 11,
		chatType: 'VIDEO',
		admission: 'KNOCK',
		temporaryAccount,
		hidePasswordField: temporaryAccount
	}) as any;

describe('directLinkRegistration (ORISO-UserService#1486)', () => {
	it('sends the link token and the link’s temporary flag', () => {
		expect(
			directLinkRegistration(
				context(true),
				{ username: 'gast-1', password: 'Secret-123!' },
				'de',
				'token-9'
			)
		).toMatchObject({
			directLinkToken: 'token-9',
			temporary: true,
			agencyId: '7',
			consultingType: '3',
			mainTopicId: '11',
			preferredLanguage: 'de'
		});
	});

	it('marks a normal link as not temporary', () => {
		expect(
			directLinkRegistration(
				context(false),
				{
					username: 'gast-1',
					password: 'Secret-123!',
					postcode: '10115'
				},
				'en',
				'token-9'
			).temporary
		).toBe(false);
	});

	it('sends the postcode the person entered on a registered link (#1795)', () => {
		expect(
			directLinkRegistration(
				context(false),
				{
					username: 'gast-1',
					password: 'Secret-123!',
					postcode: '10115'
				},
				'de',
				'token-9'
			).postcode
		).toBe('10115');
	});

	it('keeps the placeholder for a temporary account, whatever was typed', () => {
		expect(
			directLinkRegistration(
				context(true),
				{
					username: 'gast-1',
					password: 'Secret-123!',
					postcode: '10115'
				},
				'de',
				'token-9'
			).postcode
		).toBe('00000');
	});

	it('never sends the placeholder for a registered link without a postcode', () => {
		expect(() =>
			directLinkRegistration(
				context(false),
				{ username: 'gast-1', password: 'Secret-123!' },
				'de',
				'token-9'
			)
		).toThrow(/postcode/i);
	});
});
