import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { AgencyInfoCard } from './AgencyInfoCard';
import './profile.styles';

/**
 * #1169: the asker's profile card shows the agency's opening hours. The Admin
 * stores structured slots as JSON inside `openingHours`; the card renders them
 * readable, keeps legacy free text as entered and never shows raw JSON. The
 * stage answers `GET /service/agencies/{id}` like the AgencyService would.
 */

type Scenario = 'structured' | 'legacy' | 'malformed';

const OPENING_HOURS: Record<Scenario, string> = {
	structured: JSON.stringify({
		version: 1,
		openingHours: [
			{
				fromDay: 'MONDAY',
				from: '09:00',
				untilDay: 'MONDAY',
				until: '12:00'
			},
			{
				fromDay: 'WEDNESDAY',
				from: '14:00',
				untilDay: 'WEDNESDAY',
				until: '18:00'
			},
			{
				fromDay: 'FRIDAY',
				from: '22:00',
				untilDay: 'SATURDAY',
				until: '02:00'
			}
		]
	}),
	legacy: 'Mo–Do 9–17 Uhr\nFr 9–13 Uhr',
	malformed: '{"version":1,"openingHours":[{"fromDay":"MONDAY"}]}'
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

/** Installs the fetch stand-in while rendering and restores it on unmount. */
const MockedAgencyService = ({
	scenario,
	children
}: {
	scenario: Scenario;
	children: React.ReactNode;
}) => {
	const [original] = useState(() => globalThis.fetch);
	React.useMemo(() => {
		globalThis.fetch = async (input: RequestInfo | URL) => {
			const url = String(input instanceof Request ? input.url : input);
			if (/\/agencies\/7$/.test(url)) {
				return json([
					{
						id: 7,
						name: 'Caritas Beratungsstelle Mitte',
						street: 'Musterstraße',
						houseNumber: '12a',
						postcode: '10115',
						city: 'Berlin',
						phone: '+49301234567',
						openingHours: OPENING_HOURS[scenario],
						departments: []
					}
				]);
			}
			return new Response(null, { status: 404 });
		};
	}, [scenario]);
	React.useEffect(
		() => () => {
			globalThis.fetch = original;
		},
		[original]
	);
	return <>{children}</>;
};

const item = {
	agency: {
		id: 7,
		name: 'Caritas Beratungsstelle Mitte',
		postcode: '10115',
		city: 'Berlin'
	},
	session: {
		id: 1,
		topic: { id: 3, name: 'Sozialberatung', description: '' }
	}
} as any;

const meta = {
	title: 'Profile/AgencyInfoCard',
	component: AgencyInfoCard,
	parameters: { layout: 'padded' },
	args: { item },
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 480 }}>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof AgencyInfoCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const StructuredOpeningHours: Story = {
	render: (args) => (
		<MockedAgencyService scenario="structured">
			<AgencyInfoCard {...args} />
		</MockedAgencyService>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText(/09:00–12:00/)
		).toBeInTheDocument();
		await expect(canvasElement.textContent).not.toContain('"version"');
	}
};

export const LegacyFreeText: Story = {
	render: (args) => (
		<MockedAgencyService scenario="legacy">
			<AgencyInfoCard {...args} />
		</MockedAgencyService>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText(/Mo–Do 9–17 Uhr/)
		).toBeInTheDocument();
	}
};

export const MalformedPayloadIsHidden: Story = {
	render: (args) => (
		<MockedAgencyService scenario="malformed">
			<AgencyInfoCard {...args} />
		</MockedAgencyService>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByText(/Musterstraße 12a/);
		await expect(canvasElement.textContent).not.toContain('{');
	}
};
