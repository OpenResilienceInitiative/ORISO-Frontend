// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaseHandoverReadOnlyNotice } from './CaseHandoverReadOnlyNotice';

/**
 * #200: the colleague with co-access extends it from the read-only notice.
 * The real API module and fetchData over a stubbed fetch, so the extended
 * status that reaches SessionStream is the parsed body, not a raw Response.
 */
vi.mock('react-i18next', () => {
	const t = (key: string) => key;
	return { useTranslation: () => ({ t, i18n: { language: 'de' } }) };
});
vi.mock('../error/errorHandling', async (importOriginal) => ({
	...(await importOriginal<typeof import('../error/errorHandling')>()),
	redirectToErrorPage: vi.fn()
}));
vi.mock('../logout/logout', () => ({ logout: vi.fn() }));
vi.mock('../../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login' } }
}));

const extended = {
	sessionId: 5,
	status: 'GRANTED',
	canViewContent: true,
	clientConsentRequired: false,
	accessType: 'CO_ACCESS',
	expiresAt: '2026-09-25T13:00:00',
	// one extension per grant
	canExtend: false
};

type StubRequest = { url: string; init?: RequestInit };

const stubServer = (
	reply: (request: StubRequest) => { status: number; body?: unknown }
) => {
	const fetchMock = vi.fn(async (request: StubRequest) => {
		const { status, body } = reply(request);
		return { status, json: async () => body };
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
};

const renderNotice = (canExtend: boolean, onStatusChange = vi.fn()) => {
	render(
		<CaseHandoverReadOnlyNotice
			expiresAt="2026-09-25T10:30:00"
			sessionId={5}
			canExtend={canExtend}
			onStatusChange={onStatusChange}
		/>
	);
	return onStatusChange;
};

describe('CaseHandoverReadOnlyNotice — extending co-access', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'Request',
			class {
				constructor(
					public url: string,
					public init?: RequestInit
				) {}
			}
		);
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('extends the access and hands the extended status on', async () => {
		const fetchMock = stubServer(() => ({ status: 200, body: extended }));
		const onStatusChange = renderNotice(true);

		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.readOnly.extend' })
		);

		await waitFor(() =>
			expect(onStatusChange).toHaveBeenCalledWith(extended)
		);
		const [request] = fetchMock.mock.calls[0];
		expect(request.url).toMatch(/\/sessions\/5\/case-handover\/extend$/);
		expect(request.init?.method).toBe('POST');
	});

	it('offers no extension when the server does not allow one', () => {
		stubServer(() => ({ status: 200, body: extended }));
		renderNotice(false);

		expect(screen.queryByRole('button')).toBeNull();
	});

	it('re-reads the status when the extension is refused, so an expired access closes', async () => {
		const expired = {
			sessionId: 5,
			status: 'EXPIRED',
			canViewContent: false,
			clientConsentRequired: false,
			canExtend: false
		};
		stubServer((request) =>
			request.url.endsWith('/extend')
				? { status: 409 }
				: { status: 200, body: expired }
		);
		const onStatusChange = renderNotice(true);

		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.readOnly.extend' })
		);

		await waitFor(() =>
			expect(onStatusChange).toHaveBeenCalledWith(expired)
		);
	});
});
