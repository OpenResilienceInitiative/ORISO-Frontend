import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { AgencyDetailsPanel } from './AgencyDetailsPanel';
import { RegistrationContext } from '../../../globalState';
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

/** The payload the admin panel writes into the `openingHours` string. */
const structuredHours = (
	slots: Array<{
		fromDay: string;
		from: string;
		untilDay: string;
		until: string;
	}>
) => JSON.stringify({ version: 1, openingHours: slots });

const agencyWithStructuredHours: AgencyDataInterface = {
	...agencyWithBackendFields,
	id: 104,
	name: 'Beratungszentrum mit Zeitfenstern',
	openingHours: structuredHours([
		{
			fromDay: 'MONDAY',
			from: '10:00',
			untilDay: 'MONDAY',
			until: '11:00'
		},
		{
			fromDay: 'WEDNESDAY',
			from: '14:00',
			untilDay: 'WEDNESDAY',
			until: '16:00'
		}
	])
};

const agencyWithOvernightHours: AgencyDataInterface = {
	...agencyWithBackendFields,
	id: 105,
	name: 'Nachtberatung',
	openingHours: structuredHours([
		{
			fromDay: 'FRIDAY',
			from: '22:00',
			untilDay: 'SATURDAY',
			until: '02:00'
		}
	])
};

export const StructuredOpeningHours: Story = {
	args: {
		agency: agencyWithStructuredHours,
		open: true
	},
	parameters: {
		docs: {
			description: {
				story: 'Opening hours maintained as structured timeslots in the admin panel (ORISO-Admin #849) are stored as JSON inside the same string field. They are formatted for display here — a seeker never sees the raw payload.'
			}
		}
	}
};

export const OpeningHoursCrossingMidnight: Story = {
	args: {
		agency: agencyWithOvernightHours,
		open: true
	},
	parameters: {
		docs: {
			description: {
				story: 'A timeslot carries a weekday on both edges, so it may cross midnight. The second weekday is only named when the slot actually changes day.'
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
				story: 'An agency without optional DTO fields: address, hours, phone, website and about rows are hidden entirely — no placeholder values.'
			}
		}
	}
};
