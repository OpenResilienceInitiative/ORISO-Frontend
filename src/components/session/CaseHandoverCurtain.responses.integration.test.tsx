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
import { resetCaseHandoverOperationStoreForTests } from '../caseHandover/caseHandoverOperationStore';
import type { CaseHandoverStatus } from '../../api/apiCaseHandover';

const translate = (key: string) => key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../resources/scripts/endpoints', () => ({
	endpoints: {
		sessionBase: 'https://api.test/service/users/sessions',
		caseHandoverReasons:
			'https://api.test/service/users/case-handover/reasons'
	}
}));

// Keep the API wrapper and fetchData real. Replace only the browser/network boundary.
class TestRequest {
	constructor(
		readonly url: string,
		readonly init: RequestInit
	) {}
}
const idle: CaseHandoverStatus = {
	sessionId: 41,
	status: 'NOT_REQUESTED',
	canViewContent: false,
	clientConsentRequired: false,
	ownershipRevision: 7
};

beforeEach(() => {
	resetCaseHandoverOperationStoreForTests();
	vi.stubGlobal('Request', TestRequest);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const submitThroughWizard = async () => {
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'caseHandover.curtain.intro.cta'
		})
	);
	fireEvent.click(await screen.findByRole('radio'));
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.curtain.next' })
	);
	fireEvent.change(screen.getByRole('textbox'), {
		target: { value: 'Planned absence cover' }
	});
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.submit' })
	);
};

describe('real curtain to real API response integration', () => {
	it.each([
		{
			status: 'GRANTED',
			canViewContent: true,
			clientConsentRequired: false
		},
		{
			status: 'PENDING_CLIENT_CONSENT',
			canViewContent: false,
			clientConsentRequired: true
		}
	])('forwards $status from HTTP 201 without a reload', async (result) => {
		const next: CaseHandoverStatus = { ...idle, ...result, requestId: 501 };
		const network = vi.fn((request: TestRequest) =>
			Promise.resolve(
				new Response(
					JSON.stringify(
						request.init.method === 'GET'
							? [
									{
										code: 'COUNSELLOR_IS_ILL',
										label: 'Planned absence',
										clientConsentRequired: false
									}
								]
							: next
					),
					{
						status: request.init.method === 'GET' ? 200 : 201,
						headers: { 'Content-Type': 'application/json' }
					}
				)
			)
		);
		vi.stubGlobal('fetch', network);
		const onStatusChange = vi.fn();
		render(
			<CaseHandoverCurtain
				actorId="recipient-1"
				sessionId={41}
				status={idle}
				onStatusChange={onStatusChange}
			/>
		);
		await submitThroughWizard();
		await waitFor(() =>
			expect(onStatusChange).toHaveBeenCalledExactlyOnceWith(next)
		);
		expect(network).toHaveBeenCalledTimes(2);
		const request = network.mock.calls[1][0];
		expect(request.url).toBe(
			'https://api.test/service/users/sessions/41/case-handover'
		);
		expect(JSON.parse(request.init.body as string)).toEqual({
			reasonCode: 'COUNSELLOR_IS_ILL',
			explanation: 'Planned absence cover',
			expectedOwnershipRevision: 7,
			operationId: expect.any(String)
		});
	});
});
