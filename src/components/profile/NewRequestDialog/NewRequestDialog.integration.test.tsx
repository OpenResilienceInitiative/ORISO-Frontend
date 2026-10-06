// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import enCommon from '../../../resources/i18n/en/common.json';
import { UserDataProvider } from '../../../globalState/provider/UserDataProvider';
import { ModalProvider } from '../../../globalState/provider/ModalProvider';
import { NewRequestDialog } from './NewRequestDialog';

// Lottie's module setup needs a browser canvas even when the error overlay
// renders a static SVG. Only the missing jsdom rendering boundary is supplied.
const canvas = vi.hoisted(() => {
	const original = HTMLCanvasElement.prototype.getContext;
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () =>
			new Proxy(
				{},
				{
					get: (_target, key) =>
						key === 'measureText' ? () => ({ width: 0 }) : () => {}
				}
			)
	});
	return { original };
});

const translations = createInstance().use(initReactI18next);
const submittedRequests: unknown[] = [];
let overlayHost: HTMLDivElement;

// Node's Request cannot consume jsdom's AbortSignal. Preserve real URL,
// method, headers and JSON body; cancellation is outside these two cases.
class BrowserRequest extends Request {
	constructor(input: RequestInfo | URL, init?: RequestInit) {
		super(input, { ...init, signal: undefined });
	}
}

beforeEach(async () => {
	await translations.init({
		lng: 'en',
		fallbackLng: 'en',
		defaultNS: 'common',
		resources: {
			en: { common: enCommon, agencies: {}, consultingTypes: {} }
		},
		interpolation: { escapeValue: false }
	});
	submittedRequests.length = 0;
	localStorage.clear();
	sessionStorage.clear();
	vi.stubGlobal('Request', BrowserRequest);
	overlayHost = document.createElement('div');
	overlayHost.id = 'overlay';
	document.body.append(overlayHost);
	// FocusTrap remains real. jsdom lacks the visible geometry used by tabbable.
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
		() => [{ width: 100, height: 40 }] as unknown as DOMRectList
	);
});

afterEach(() => {
	cleanup();
	overlayHost.remove();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = canvas.original;
});

const installHttpBoundary = (status: number, reason: string) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (request: Request) => {
			const url = new URL(request.url);
			if (request.method === 'GET') {
				if (url.pathname === '/service/agencies/topics') {
					return Response.json([
						{ id: 7, name: 'Social counselling' },
						{ id: 9, name: 'Family counselling' }
					]);
				}
				if (url.pathname === '/service/agencies/by-tenant') {
					expect(['10115', '10117']).toContain(
						url.searchParams.get('postcode')
					);
					expect(['7', '9']).toContain(
						url.searchParams.get('topicId')
					);
					return Response.json([
						{ id: 42, name: 'Existing centre', consultingType: 1 },
						{ id: 43, name: 'Another centre', consultingType: 1 }
					]);
				}
				if (url.pathname === '/service/users/consultants/languages') {
					return Response.json({ languages: [] });
				}
				if (url.pathname === '/service/users/data') {
					return Response.json({ userId: 'synthetic-asker' });
				}
			}
			if (
				request.method === 'POST' &&
				url.pathname === '/service/users/askers/session/new'
			) {
				submittedRequests.push(await request.json());
				return new Response('', {
					status,
					headers: { 'X-Reason': reason }
				});
			}
			throw new Error(
				`Unexpected HTTP request: ${request.method} ${request.url}`
			);
		})
	);
};

describe('New request AVV feedback through the real HTTP and UI boundaries', () => {
	it.each([
		[
			403,
			'DPA_NEW_COUNSELLING_NOT_ALLOWED',
			'New counselling is currently restricted',
			'The counselling organisation must confirm the current data processing agreement. Contact your counselling centre. Counselling that has already begun can continue.'
		],
		[
			502,
			'DPA_POLICY_UNAVAILABLE',
			'Counselling availability cannot be checked',
			'The agreement status could not be verified. Please try again. Your entries are retained.'
		]
	] as const)(
		'explains HTTP%s and retains the changed topic, postcode and centre for retry',
		async (status, reason, title, text) => {
			installHttpBoundary(status, reason);
			const user = userEvent.setup();
			render(
				<I18nextProvider i18n={translations}>
					<MemoryRouter>
						<UserDataProvider>
							<ModalProvider>
								<NewRequestDialog
									open
									onClose={() => {}}
									preselectedTopicId={7}
									prefilledPostcode="10115"
									knownAgencyIds={[42]}
								/>
							</ModalProvider>
						</UserDataProvider>
					</MemoryRouter>
				</I18nextProvider>
			);
			await screen.findByRole('radio', { name: 'Existing centre' });
			await user.click(screen.getByRole('combobox', { name: 'Topics' }));
			await user.click(
				await screen.findByRole('option', {
					name: 'Family counselling'
				})
			);
			const postcode = screen.getByRole('spinbutton', {
				name: 'Your zip code'
			});
			await user.clear(postcode);
			await user.type(postcode, '10117');
			await user.click(
				await screen.findByRole('radio', { name: 'Another centre' })
			);
			await user.click(screen.getByRole('button', { name: 'Register' }));
			const expectedRequest = {
				agencyId: 43,
				mainTopicId: 9,
				postcode: '10117',
				consultingType: '1'
			};
			await waitFor(() =>
				expect(submittedRequests).toEqual([expectedRequest])
			);
			const notice = await screen.findByRole('dialog', { name: title });
			expect(
				within(notice).getByRole('heading', { name: title })
			).toBeTruthy();
			expect(within(notice).getByText(text)).toBeTruthy();
			await user.click(
				within(notice).getByRole('button', { name: 'Close' })
			);
			await waitFor(() =>
				expect(screen.queryByRole('dialog', { name: title })).toBeNull()
			);
			expect(
				screen.getByRole('combobox', { name: 'Topics' }).textContent
			).toBe('Family counselling');
			expect(
				(
					screen.getByRole('spinbutton', {
						name: 'Your zip code'
					}) as HTMLInputElement
				).value
			).toBe('10117');
			expect(
				(
					screen.getByRole('radio', {
						name: 'Another centre'
					}) as HTMLInputElement
				).checked
			).toBe(true);
			await user.click(screen.getByRole('button', { name: 'Register' }));
			await waitFor(() =>
				expect(submittedRequests).toEqual([
					expectedRequest,
					expectedRequest
				])
			);
		}
	);
});
