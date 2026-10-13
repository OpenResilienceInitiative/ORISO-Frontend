// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiPostRegistration, autoLogin } = vi.hoisted(() => ({
	apiPostRegistration: vi.fn(),
	autoLogin: vi.fn()
}));

vi.mock('../../api/apiPostRegistration', () => ({ apiPostRegistration }));
vi.mock('./autoLogin', () => ({ autoLogin }));

const { useRegisterThenLogin } = await import('./useRegisterThenLogin');

const data = {
	username: 'katze_mika_1234',
	password: 'generated-Secret-1',
	agencyId: '7'
} as any;
const tenant = { id: 1 } as any;

/** The account is created, then the login after it fails. */
const failAfterAccountCreated = () =>
	apiPostRegistration.mockImplementationOnce(
		(
			_url: string,
			_data: unknown,
			_multi: boolean,
			_tenant: unknown,
			onAccountCreated?: () => void
		) => {
			onAccountCreated?.();
			return Promise.reject(new Error('auto-login failed'));
		}
	);

/**
 * The anonymous chat and the invite link generate the User-ID and password
 * themselves. When the account was created and only the login after it
 * failed, sending the person to the login page does not help — nobody there
 * knows that password. The same button has to try the login again, and must
 * never register a second account (#1533).
 */
describe('useRegisterThenLogin', () => {
	beforeEach(() => {
		apiPostRegistration.mockReset();
		apiPostRegistration.mockResolvedValue(undefined);
		autoLogin.mockReset();
		autoLogin.mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
	});

	it('registers, and the account is marked as created', async () => {
		const { result } = renderHook(() => useRegisterThenLogin());

		await act(() => result.current.submit(data, false, tenant));

		expect(apiPostRegistration).toHaveBeenCalledWith(
			expect.stringContaining('/service/users/askers/new'),
			data,
			false,
			tenant,
			expect.any(Function)
		);
		expect(autoLogin).not.toHaveBeenCalled();
	});

	it('registers again when the first attempt never created the account', async () => {
		apiPostRegistration.mockRejectedValueOnce(new Error('409'));
		const { result } = renderHook(() => useRegisterThenLogin());

		await act(async () => {
			await expect(
				result.current.submit(data, false, tenant)
			).rejects.toThrow('409');
		});
		expect(result.current.accountCreated()).toBe(false);

		await act(() => result.current.submit(data, false, tenant));

		expect(apiPostRegistration).toHaveBeenCalledTimes(2);
		expect(autoLogin).not.toHaveBeenCalled();
	});

	it('only logs in again once the account exists', async () => {
		failAfterAccountCreated();
		const { result } = renderHook(() => useRegisterThenLogin());

		await act(async () => {
			await expect(
				result.current.submit(data, false, tenant)
			).rejects.toThrow('auto-login failed');
		});
		expect(result.current.accountCreated()).toBe(true);

		await act(() => result.current.submit(data, false, tenant));

		expect(
			apiPostRegistration,
			'a second registration would be a second account for the same person'
		).toHaveBeenCalledTimes(1);
		expect(autoLogin).toHaveBeenCalledWith({
			username: 'katze_mika_1234',
			password: 'generated-Secret-1',
			tenantData: tenant
		});
	});

	it('stays the same object across renders', () => {
		const { result, rerender } = renderHook(() => useRegisterThenLogin());
		const first = result.current;

		rerender();

		expect(result.current).toBe(first);
	});

	it('keeps offering the login when the retry fails too', async () => {
		failAfterAccountCreated();
		autoLogin.mockRejectedValueOnce(new Error('still down'));
		const { result } = renderHook(() => useRegisterThenLogin());

		await act(async () => {
			await expect(
				result.current.submit(data, false, tenant)
			).rejects.toThrow();
		});
		await act(async () => {
			await expect(
				result.current.submit(data, false, tenant)
			).rejects.toThrow('still down');
		});
		await act(() => result.current.submit(data, false, tenant));

		expect(apiPostRegistration).toHaveBeenCalledTimes(1);
		expect(autoLogin).toHaveBeenCalledTimes(2);
	});
});
