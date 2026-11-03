// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AgencyInfoCard } from './AgencyInfoCard';
import { apiGetAgencyById } from '../../api/apiGetAgencyId';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../departmentLegal/DepartmentLegalSection', () => ({
	DepartmentLegalSection: () => <div data-testid="department-legal" />
}));

vi.mock('../../api/apiGetAgencyId', () => ({
	apiGetAgencyById: vi.fn().mockResolvedValue({
		id: 7,
		name: 'e2e-0145 Agency',
		postcode: '10115',
		city: 'Berlin',
		street: 'Musterstraße',
		houseNumber: '12a',
		phone: '+49301234567',
		openingHours: 'Mo-Fr 9-17 Uhr',
		departments: [
			{ topicId: 3, hasPublishedDpp: true, hasPublishedImprint: true }
		]
	})
}));

const item: any = {
	agency: {
		id: 7,
		name: 'e2e-0145 Agency',
		postcode: '10115',
		city: 'Berlin'
	},
	session: {
		id: 1,
		topic: { id: 3, name: 'Sozialberatung', description: '' }
	}
};

describe('AgencyInfoCard', () => {
	afterEach(cleanup);

	it('renders topic, agency address, map link, phone and opening hours', async () => {
		render(<AgencyInfoCard item={item} />);

		expect(screen.getByText('Sozialberatung')).toBeTruthy();
		await waitFor(() => {
			expect(screen.getByText(/Musterstraße 12a/)).toBeTruthy();
		});
		expect(screen.getByText(/10115 Berlin/)).toBeTruthy();

		const mapLink = screen.getByRole('link', {
			name: 'profile.data.agency.mapLink'
		}) as HTMLAnchorElement;
		expect(mapLink.href).toContain('openstreetmap.org/search');

		const phoneLink = screen.getByRole('link', {
			name: '+49301234567'
		}) as HTMLAnchorElement;
		expect(phoneLink.href).toBe('tel:+49301234567');

		expect(screen.getByText('Mo-Fr 9-17 Uhr')).toBeTruthy();
		expect(screen.getByTestId('department-legal')).toBeTruthy();
	});

	it('renders structured opening-hour slots readable instead of raw JSON (#1169)', async () => {
		vi.mocked(apiGetAgencyById).mockResolvedValueOnce({
			id: 7,
			name: 'e2e-0145 Agency',
			openingHours: JSON.stringify({
				version: 1,
				openingHours: [
					{
						fromDay: 'MONDAY',
						from: '10:00',
						untilDay: 'MONDAY',
						until: '12:00'
					},
					{
						fromDay: 'FRIDAY',
						from: '22:00',
						untilDay: 'SATURDAY',
						until: '02:00'
					}
				]
			})
		} as any);

		const { container } = render(<AgencyInfoCard item={item} />);

		expect(
			await screen.findByText(
				'weekday.monday 10:00–12:00 · weekday.friday 22:00 – weekday.saturday 02:00'
			)
		).toBeTruthy();
		expect(container.textContent).not.toContain('"version"');
		expect(container.textContent).not.toContain('{');
	});

	it('hides the opening hours row when the structured payload holds no usable slot', async () => {
		vi.mocked(apiGetAgencyById).mockResolvedValueOnce({
			id: 7,
			name: 'Agency with broken hours',
			street: 'Musterstraße',
			openingHours: '{"version":1,"openingHours":[{"fromDay":"MONDAY"}]}'
		} as any);

		const { container } = render(<AgencyInfoCard item={item} />);

		await screen.findByText(/Musterstraße/);
		expect(
			screen.queryByText('profile.data.agency.openingHours.label')
		).toBeNull();
		expect(container.textContent).not.toContain('{');
	});
});
