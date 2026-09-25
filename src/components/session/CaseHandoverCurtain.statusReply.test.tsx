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
import { CaseHandoverCurtain } from './CaseHandoverCurtain';
import { CaseHandoverStatus } from '../../api/apiCaseHandover';

/**
 * The real API module and fetchData over a stubbed fetch: the curtain must
 * hand the parsed status on, or SessionStream never sees canViewContent and
 * keeps the case hidden after a successful reclaim or request.
 */
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => {
	const t = (key: string) => key;
	return { useTranslation: () => ({ t }) };
});
vi.mock('../error/errorHandling', async (importOriginal) => ({
	...(await importOriginal<typeof import('../error/errorHandling')>()),
	redirectToErrorPage: vi.fn()
}));
vi.mock('../logout/logout', () => ({ logout: vi.fn() }));
vi.mock('../../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login' } }
}));

const byCy = (id: string) =>
	document.querySelector(`[data-cy="${id}"]`) as HTMLElement;

const granted: CaseHandoverStatus = {
	sessionId: 5,
	status: 'GRANTED',
	canViewContent: true,
	clientConsentRequired: false
};

const stubServer = () =>
	vi.stubGlobal(
		'fetch',
		vi.fn(async (request: { url: string; init?: RequestInit }) => {
			if (request.url.includes('/case-handover/reasons')) {
				return {
					status: 200,
					json: async () => [
						{
							code: 'COUNSELLOR_IS_ILL',
							label: 'Unplanned absence',
							clientConsentRequired: false
						}
					]
				};
			}
			return {
				status: request.url.endsWith('/reclaim') ? 200 : 201,
				json: async () => granted
			};
		})
	);

describe('CaseHandoverCurtain passes the server status on', () => {
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
		stubServer();
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('after a reclaim', async () => {
		const onStatusChange = vi.fn();
		render(
			<CaseHandoverCurtain
				sessionId={5}
				status={{
					sessionId: 5,
					status: 'NOT_REQUESTED',
					canViewContent: false,
					clientConsentRequired: false,
					canReclaim: true
				}}
				onStatusChange={onStatusChange}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'caseHandover.curtain.reclaim.cta'
			})
		);

		await waitFor(() => expect(onStatusChange).toHaveBeenCalled());
		expect(onStatusChange).toHaveBeenCalledWith(granted);
	});

	it('after an access request', async () => {
		const onStatusChange = vi.fn();
		render(
			<CaseHandoverCurtain
				sessionId={5}
				status={null}
				onStatusChange={onStatusChange}
			/>
		);

		fireEvent.click(byCy('case-handover-curtain-start'));
		fireEvent.click(
			await screen.findByRole('radio', { name: /Unplanned absence/ })
		);
		fireEvent.click(byCy('case-handover-curtain-next'));
		fireEvent.change(byCy('case-handover-curtain-explanation'), {
			target: { value: 'Covering while the colleague is ill.' }
		});
		fireEvent.click(byCy('case-handover-curtain-next'));

		await waitFor(() => expect(onStatusChange).toHaveBeenCalled());
		expect(onStatusChange).toHaveBeenCalledWith(granted);
	});
});
