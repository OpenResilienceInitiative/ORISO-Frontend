import { beforeEach, describe, expect, it, vi } from 'vitest';

const t = vi.fn((key: string) => key);

vi.mock('i18next', () => ({
	default: { t: (key: string) => t(key) }
}));

describe('callMediaErrorMessage', () => {
	beforeEach(() => {
		t.mockClear();
	});

	it('maps permission, missing-device, and unsupported errors to keys', async () => {
		const { callMediaErrorMessage } = await import(
			'./callMediaErrorMessage'
		);

		expect(callMediaErrorMessage({ name: 'NotAllowedError' })).toBe(
			'calls.error.cannotAccesscalls.error.grantPermissions'
		);
		expect(callMediaErrorMessage({ name: 'NotFoundError' })).toBe(
			'calls.error.cannotAccesscalls.error.noDevice'
		);
		expect(callMediaErrorMessage({ name: 'NotSupportedError' })).toBe(
			'calls.error.cannotAccesscalls.error.browserUnsupported'
		);
		expect(callMediaErrorMessage({ name: 'Other', message: 'boom' })).toBe(
			'calls.error.cannotAccessboom'
		);
		expect(callMediaErrorMessage({ name: 'Other' })).toBe(
			'calls.error.cannotAccesscalls.error.unknown'
		);
	});
});
