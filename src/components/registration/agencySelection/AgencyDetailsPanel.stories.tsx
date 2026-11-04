import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { AgencyDetailsPanel } from './AgencyDetailsPanel';
import { AppConfigContext, RegistrationContext } from '../../../globalState';
import { LanguagesContext } from '../../../globalState/provider/LanguagesProvider';
import { useAppConfig } from '../../../hooks/useAppConfig';
import { phone390Globals } from '../../message/messageStoryShell';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';

const meta = {
	title: 'REGISTRATION/AgencyDetailsPanel',
	component: AgencyDetailsPanel,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Expanded details for an agency in the registration agency selection. ' +
					'Renders only backend-provided fields from the public agency DTO ' +
					'(AgencyService #242) — a missing field hides its row, nothing is ' +
					'ever substituted with placeholder data.'
			}
		}
	}
} satisfies Meta<typeof AgencyDetailsPanel>;

export default meta;
type Story = StoryObj<typeof AgencyDetailsPanel>;

const agencyWithBackendFields: AgencyDataInterface = {
	id: 101,
	name: 'Beratungszentrum Köln Mitte',
	description:
		'Beratung zu Familie, sozialen Notlagen und Migration. Termine sind online, telefonisch oder vor Ort möglich.',
	city: 'Köln',
	postcode: '50667',
	street: 'Domkloster',
	houseNumber: '3',
	phone: '0221 123 45 0',
	openingHours: 'Mo-Do 9-17 Uhr · Fr 9-13 Uhr',
	url: 'https://beratung.example.org',
	consultingType: 1,
	offline: false
};

const agencyWithoutOptionalFields: AgencyDataInterface = {
	id: 102,
	name: 'Onlineberatung ohne Kontaktdaten',
	description: '',
	city: '',
	postcode: '',
	consultingType: 1,
	offline: false
};

const selectedTopic = {
	id: 7,
	name: 'Familienberatung'
} as TopicsDataInterface;

const agencyWithDepartmentOverrides: AgencyDataInterface = {
	...agencyWithBackendFields,
	id: 103,
	name: 'Beratungszentrum mit Fachbereich',
	topicIds: [7],
	departments: [
		{
			topicId: 7,
			openingHours: 'Di + Do 10-14 Uhr',
			phoneExtension: '12',
			floorLocation: '3. OG, Raum 12'
		}
	]
};

const withSelectedTopic = (StoryComponent: React.ComponentType) => (
	<RegistrationContext.Provider
		value={{
			registrationData: { mainTopic: selectedTopic } as any
		}}
	>
		<StoryComponent />
	</RegistrationContext.Provider>
);

export const BackendFields: Story = {
	args: {
		agency: agencyWithBackendFields,
		open: true
	}
};

export const DepartmentOverrides: Story = {
	args: {
		agency: agencyWithDepartmentOverrides,
		open: true
	},
	decorators: [withSelectedTopic],
	parameters: {
		docs: {
			description: {
				story: "The department matching the selected topic overrides the agency's opening hours, appends its phone extension and adds a floor location."
			}
		}
	}
};

export const EmptyState: Story = {
	args: {
		agency: agencyWithoutOptionalFields,
		open: true
	},
	parameters: {
		docs: {
			description: {
				story: 'An agency without optional DTO fields: address, phone, website and about rows are hidden entirely — no placeholder values. Languages always render.'
			}
		}
	}
};

const FIXED_LANGUAGES = { fixed: ['de'], spoken: [] as string[] };

/**
 * Single-domain multitenancy resolves the tenant from the `agencyId` request
 * header, so the languages request must carry it. The mocked endpoint answers
 * with the counsellors' languages only when that header is present; without it
 * the story shows the fixed language alone, as the bug in #1434 did.
 */
const mockConsultantLanguagesEndpoint = () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input, init) => {
		const request = input instanceof Request ? input : null;
		const url = request
			? request.url
			: typeof input === 'string'
				? input
				: input.toString();
		if (url.includes('/consultants/languages')) {
			// fetchData() passes a Request object, so the headers live on it.
			const agencyHeader = new Headers(
				request?.headers ?? init?.headers
			).get('agencyId');
			return new Response(
				JSON.stringify({
					languages: agencyHeader ? ['en', 'fr', 'ru'] : []
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
		return originalFetch(input, init);
	};
	return () => {
		globalThis.fetch = originalFetch;
	};
};

const SingleDomainTenant = ({ children }: { children: React.ReactNode }) => {
	const config = useAppConfig();
	return (
		<AppConfigContext.Provider
			value={{ ...config, multitenancyWithSingleDomainEnabled: true }}
		>
			<LanguagesContext.Provider value={FIXED_LANGUAGES}>
				{children}
			</LanguagesContext.Provider>
		</AppConfigContext.Provider>
	);
};

const withSingleDomainLanguages = (StoryComponent: React.ComponentType) => (
	<SingleDomainTenant>
		<StoryComponent />
	</SingleDomainTenant>
);

const fourLanguagesPlay =
	(expected: string) =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => expect(canvas.getByText(expected)).toBeVisible());
	};

export const FourLanguagesDE: Story = {
	args: {
		agency: agencyWithBackendFields,
		open: true
	},
	decorators: [withSingleDomainLanguages],
	beforeEach: mockConsultantLanguagesEndpoint,
	globals: { ...phone390Globals, locale: 'de' },
	play: fourLanguagesPlay(
		'Deutsch (DE) | Englisch (EN) | Französisch (FR) | Russisch (RU)'
	),
	parameters: {
		docs: {
			description: {
				story: 'Single-domain multitenancy on: the languages request carries the `agencyId` header, so every counsellor language is listed (4 languages, 390px, DE). ORISO-Frontend#1434.'
			}
		}
	}
};

export const FourLanguagesEN: Story = {
	...FourLanguagesDE,
	globals: { ...phone390Globals, locale: 'en' },
	play: fourLanguagesPlay(
		'English (EN) | French (FR) | German (DE) | Russian (RU)'
	)
};
