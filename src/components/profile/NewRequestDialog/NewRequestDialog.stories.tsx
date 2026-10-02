import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../resources/i18n/de/common.json';
import enCommon from '../../../resources/i18n/en/common.json';
import frCommon from '../../../resources/i18n/fr/common.json';
import { UserDataProvider } from '../../../globalState/provider/UserDataProvider';
import { ModalProvider } from '../../../globalState/provider/ModalProvider';
import { NewRequestDialog, NewRequestDialogProps } from './NewRequestDialog';

type ReviewArgs = NewRequestDialogProps & {
	locale: 'de' | 'en' | 'fr';
	failureStatus: 403 | 502;
};

const catalogues = { de: deCommon, en: enCommon, fr: frCommon };
const submittedRequests: unknown[] = [];

/** Real UI/providers and translations; only the HTTP service boundary is replaced. */
const RequestReview = ({ locale, failureStatus, ...args }: ReviewArgs) => {
	const translations = React.useMemo(() => {
		const instance = createInstance().use(initReactI18next);
		void instance.init({
			lng: locale,
			fallbackLng: 'de',
			defaultNS: 'common',
			initImmediate: false,
			resources: {
				de: { common: deCommon, agencies: {}, consultingTypes: {} },
				en: { common: enCommon, agencies: {}, consultingTypes: {} },
				fr: { common: frCommon, agencies: {}, consultingTypes: {} }
			},
			interpolation: { escapeValue: false }
		});
		return instance;
	}, [locale]);
	return (
		<I18nextProvider i18n={translations}>
			<UserDataProvider>
				<ModalProvider>
					<NewRequestDialog {...args} />
				</ModalProvider>
			</UserDataProvider>
		</I18nextProvider>
	);
};

const installHttpBoundary = (status: ReviewArgs['failureStatus']) => {
	const originalFetch = globalThis.fetch;
	submittedRequests.length = 0;
	const fixtureFetch: typeof fetch = async (input, init) => {
		const request = new Request(input, init);
		const url = new URL(request.url);
		if (request.method === 'GET') {
			if (url.pathname === '/service/agencies/topics') {
				return Response.json([
					{ id: 7, name: 'Social counselling' },
					{ id: 9, name: 'Family counselling' }
				]);
			}
			if (url.pathname === '/service/agencies/by-tenant') {
				return Response.json([
					{ id: 42, name: 'Existing centre', consultingType: 1 },
					{ id: 43, name: 'Another centre', consultingType: 1 }
				]);
			}
			if (url.pathname === '/service/users/consultants/languages') {
				return Response.json({ languages: [] });
			}
			if (url.pathname === '/service/users/data') {
				return Response.json({ userId: 'storybook-asker' });
			}
		}
		if (
			request.method === 'POST' &&
			url.pathname === '/service/users/askers/session/new'
		) {
			submittedRequests.push(await request.json());
			return new Response('', {
				status,
				headers: {
					'X-Reason':
						status === 403
							? 'DPA_NEW_COUNSELLING_NOT_ALLOWED'
							: 'DPA_POLICY_UNAVAILABLE'
				}
			});
		}
		// Framework asset reads may use the preview's fetch. An unexpected
		// service call or mutation must never send synthetic form data outside.
		if (
			url.pathname.startsWith('/service/') ||
			!['GET', 'HEAD'].includes(request.method)
		) {
			throw new Error(
				`Unexpected review-fixture HTTP request: ${request.method} ${url.pathname}`
			);
		}
		return originalFetch(input, init);
	};
	globalThis.fetch = fixtureFetch;
	return () => {
		if (globalThis.fetch === fixtureFetch) globalThis.fetch = originalFetch;
	};
};

const meta = {
	title: 'Organisms/NewRequestDialog',
	component: RequestReview,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'New-request AVV explanations from real HTTP responses. Uses the existing request dialog, fields, providers and bundled German, English and French copy. These local stories do not prove a deployed backend or Matrix enforcement.'
			}
		}
	},
	args: {
		open: true,
		onClose: fn(),
		preselectedTopicId: 7,
		prefilledPostcode: '10115',
		knownAgencyIds: [42],
		locale: 'de',
		failureStatus: 403
	},
	argTypes: {
		locale: { control: 'select', options: ['de', 'en', 'fr'] },
		failureStatus: { control: false }
	},
	beforeEach: ({ args }) => installHttpBoundary(args.failureStatus)
} satisfies Meta<ReviewArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const openFailure: Story['play'] = async ({ args }) => {
	const view = within(document.body);
	const catalogue = catalogues[args.locale];
	await view.findByRole('radio', { name: 'Existing centre' });
	await userEvent.click(
		view.getByRole('combobox', {
			name: catalogue.profile.data.register.consultingTypeSelect.label
		})
	);
	await userEvent.click(
		await view.findByRole('option', { name: 'Family counselling' })
	);
	const postcode = view.getByRole('spinbutton', {
		name: catalogue.registration.agencySelection.postcode.label
	});
	await userEvent.clear(postcode);
	await userEvent.type(postcode, '10117');
	await userEvent.click(
		await view.findByRole('radio', { name: 'Another centre' })
	);
	await userEvent.click(
		view.getByRole('button', {
			name: catalogue.profile.data.register.button.label
		})
	);
	const copy =
		args.failureStatus === 403
			? catalogue.counselling.dpa.restricted
			: catalogue.counselling.dpa.unavailable;
	const notice = await view.findByRole('dialog', { name: copy.title });
	await waitFor(() =>
		expect(within(notice).getByText(copy.text)).toBeVisible()
	);
	await expect(notice).toHaveAccessibleDescription(copy.text);
	await expect(submittedRequests).toEqual([
		{ agencyId: 43, mainTopicId: 9, postcode: '10117', consultingType: '1' }
	]);
	await userEvent.tab();
	await expect(notice).toContainElement(
		document.activeElement as HTMLElement
	);
};

export const Ready: Story = {};

export const Restricted: Story = { play: openFailure };

export const VerificationUnavailable: Story = {
	args: { failureStatus: 502, locale: 'en' },
	play: openFailure
};

export const RestrictedFrench: Story = {
	args: { locale: 'fr' },
	play: openFailure
};
