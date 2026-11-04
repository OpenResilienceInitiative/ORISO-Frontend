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
				{ username: 'gast-1', password: 'Secret-123!' },
				'en',
				'token-9'
			).temporary
		).toBe(false);
	});
});
