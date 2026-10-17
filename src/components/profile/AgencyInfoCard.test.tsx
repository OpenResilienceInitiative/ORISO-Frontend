// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgencyInfoCard } from './AgencyInfoCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../departmentLegal/DepartmentLegalSection', () => ({
	DepartmentLegalSection: ({ variant }: { variant?: string }) => (
		<div data-testid="department-legal" data-variant={variant} />
	)
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
		const legal = screen.getByTestId('department-legal');
		expect(legal).toBeTruthy();
		expect(legal.getAttribute('data-variant')).toBe('modal');
	});
});
