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
import { DepartmentLegalSection } from './DepartmentLegalSection';
import { apiGetDepartmentLegal } from '../../api/apiGetDepartmentLegal';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: { language: 'de' }
	})
}));

vi.mock('../../api/apiGetDepartmentLegal', () => ({
	apiGetDepartmentLegal: vi.fn()
}));

const mockTenant = {
	content: { privacy: '<p>Träger Datenschutz</p>' }
};

vi.mock('../../globalState/provider/TenantProvider', () => ({
	useTenant: () => mockTenant
}));

vi.mock('../legalContent/legalContent.styles.scss', () => ({}));

const topic = {
	id: 7,
	name: 'Suchtberatung'
} as TopicsDataInterface;

const agencyWithDepartment = {
	id: 42,
	name: 'Beratungsstelle',
	departments: [
		{ topicId: 7, hasPublishedDpp: true, hasPublishedImprint: false }
	]
} as unknown as AgencyDataInterface;

const expandSection = () =>
	fireEvent.click(
		screen.getByText('Datenschutzhinweise der Beratungsstelle')
	);

describe('DepartmentLegalSection', () => {
	beforeEach(() => {
		vi.mocked(apiGetDepartmentLegal).mockResolvedValue({
			dpp: { content: JSON.stringify({ de: '<p>Fachbereich DPP</p>' }) },
			imprint: { content: null }
		});
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('renders nothing when the backend sends no departments (older backend)', () => {
		const { container } = render(
			<DepartmentLegalSection
				agency={{ id: 42 } as AgencyDataInterface}
				topic={topic}
			/>
		);

		expect(container.innerHTML).toBe('');
		expect(apiGetDepartmentLegal).not.toHaveBeenCalled();
	});

	it('renders nothing when the department has no published legal text', () => {
		const { container } = render(
			<DepartmentLegalSection
				agency={
					{
						id: 42,
						departments: [{ topicId: 7 }]
					} as AgencyDataInterface
				}
				topic={topic}
			/>
		);

		expect(container.innerHTML).toBe('');
	});

	it('lazy-loads the legal endpoint only after expanding', async () => {
		render(
			<DepartmentLegalSection
				agency={agencyWithDepartment}
				topic={topic}
			/>
		);

		expect(screen.getByText(/Suchtberatung/)).toBeDefined();
		expect(apiGetDepartmentLegal).not.toHaveBeenCalled();

		expandSection();

		await waitFor(() =>
			expect(apiGetDepartmentLegal).toHaveBeenCalledWith(
				42,
				7,
				expect.anything()
			)
		);
		await waitFor(() =>
			expect(screen.getByText('Fachbereich DPP')).toBeDefined()
		);
	});

	it('prefers the department dpp over the tenant content in the consent variant', async () => {
		render(
			<DepartmentLegalSection
				agency={agencyWithDepartment}
				topic={topic}
				variant="consent"
			/>
		);

		expandSection();

		await waitFor(() =>
			expect(screen.getByText('Fachbereich DPP')).toBeDefined()
		);
		expect(screen.queryByText('Träger Datenschutz')).toBeNull();
	});

	it('falls back to the tenant content when the endpoint is unavailable (e.g. 404 before AgencyService #90)', async () => {
		// apiGetDepartmentLegal maps 404/network errors to null
		vi.mocked(apiGetDepartmentLegal).mockResolvedValue(null);

		render(
			<DepartmentLegalSection
				agency={agencyWithDepartment}
				topic={topic}
				variant="consent"
			/>
		);

		expandSection();

		await waitFor(() =>
			expect(screen.getByText('Träger Datenschutz')).toBeDefined()
		);
	});

	it('shows an unavailable notice when neither department nor tenant content exists', async () => {
		vi.mocked(apiGetDepartmentLegal).mockResolvedValue(null);
		mockTenant.content.privacy = '';

		render(
			<DepartmentLegalSection
				agency={agencyWithDepartment}
				topic={topic}
				variant="consent"
			/>
		);

		expandSection();

		await waitFor(() =>
			expect(
				screen.getByText(
					'Die Datenschutzhinweise können derzeit nicht geladen werden.'
				)
			).toBeDefined()
		);

		mockTenant.content.privacy = '<p>Träger Datenschutz</p>';
	});
});
