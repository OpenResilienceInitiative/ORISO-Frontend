// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fetchData, FETCH_METHODS } from './fetchData';
import {
	apiGetTemporaryAccount,
	apiPutMessageRetention
} from './apiTemporaryAccount';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn() };
});

beforeEach(() => vi.clearAllMocks());

describe('temporary account API (ORISO-UserService#1486)', () => {
	it('reads the guest’s own temporary account', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			messageRetention: 'GUEST_DECIDES',
			keepMessages: null
		});
		await expect(apiGetTemporaryAccount()).resolves.toMatchObject({
			messageRetention: 'GUEST_DECIDES'
		});
		expect(vi.mocked(fetchData).mock.calls[0][0]).toMatchObject({
			url: expect.stringMatching(/\/service\/users\/temporary-account$/),
			method: FETCH_METHODS.GET
		});
	});

	it('treats 404 as a normal account', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Response('', { status: 404 })
		);
		await expect(apiGetTemporaryAccount()).resolves.toBeNull();
	});

	it('passes other failures on', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Response('', { status: 500 })
		);
		await expect(apiGetTemporaryAccount()).rejects.toBeInstanceOf(Response);
	});

	it('saves the guest’s answer once', async () => {
		vi.mocked(fetchData).mockResolvedValue({});
		await expect(apiPutMessageRetention(true)).resolves.toBe('saved');
		expect(vi.mocked(fetchData).mock.calls[0][0]).toMatchObject({
			url: expect.stringMatching(
				/\/temporary-account\/message-retention$/
			),
			method: FETCH_METHODS.PUT,
			bodyData: '{"keepMessages":true}'
		});
	});

	it('reports 409 as already decided', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Response('', { status: 409 })
		);
		await expect(apiPutMessageRetention(false)).resolves.toBe(
			'alreadyDecided'
		);
	});
});
