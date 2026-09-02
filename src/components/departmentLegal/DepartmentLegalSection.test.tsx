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
import { clearDepartmentLegalCache } from '../../api/apiGetDepartmentLegal';
import { fetchData } from '../../api/fetchData';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				'registration.agency.legal.headline':
					'Datenschutzhinweise der Beratungsstelle',
				'registration.agency.legal.department': 'Fachbereich',
				'registration.agency.legal.unavailable':
					'Die Datenschutzhinweise können derzeit nicht geladen werden.',
				'registration.agency.legal.imprintHeadline':
					'Impressum der Beratungsstelle'
			})[key] ?? key,
		i18n: { language: 'de' }
	})
}));

vi.mock('../../api/fetchData', async () => {
	const actual = await vi.importActual<typeof import('../../api/fetchData')>(
		'../../api/fetchData'
	);
	return {
		...actual,
		fetchData: vi.fn()
	};
});

const mockTenant: {
	content: { privacy: string; renderedPrivacy?: string };
} = {
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
		clearDepartmentLegalCache();
		vi.mocked(fetchData).mockResolvedValue({
			dpp: { content: JSON.stringify({ de: '<p>Fachbereich DPP</p>' }) },
			imprint: { content: null }
		});
	});

	afterEach(() => {
		cleanup();
		clearDepartmentLegalCache();
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
		expect(fetchData).not.toHaveBeenCalled();
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
		expect(fetchData).not.toHaveBeenCalled();

		expandSection();

		await waitFor(() => expect(fetchData).toHaveBeenCalled());
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
		vi.mocked(fetchData).mockRejectedValue(new Error('NO_MATCH'));

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

	/**
	 * Regression pin for the defect recorded in `CONTEXT-legal-documents.md`
	 * ("Known traps", 2026-08-16): this component passed the raw
	 * `tenant.content.privacy` into the consent display, so an unsubstituted
	 * `${responsible}` could already be shown to help-seekers at registration.
	 * `renderedPrivacy` — the same text with the data-protection placeholders
	 * rendered by TenantService — was declared in `TenantDataInterface` and
	 * read nowhere.
	 */
	/* eslint-disable no-template-curly-in-string -- the unsubstituted
	   `${responsible}` placeholder is the subject of these assertions. */
	describe('tenant fallback uses the rendered privacy text', () => {
		afterEach(() => {
			mockTenant.content.privacy = '<p>Träger Datenschutz</p>';
			delete mockTenant.content.renderedPrivacy;
		});

		it('shows the substituted text, not the raw placeholder', async () => {
			vi.mocked(fetchData).mockResolvedValue(null);
			mockTenant.content.privacy =
				'<p>Verantwortlich ist ${responsible}.</p>';
			mockTenant.content.renderedPrivacy =
				'<p>Verantwortlich ist Caritas Musterstadt.</p>';

			const { container } = render(
				<DepartmentLegalSection
					agency={agencyWithDepartment}
					topic={topic}
					variant="consent"
				/>
			);

			expandSection();

			await waitFor(() =>
				expect(
					screen.getByText(/Verantwortlich ist Caritas Musterstadt\./)
				).toBeDefined()
			);
			expect(container.textContent).not.toContain('${responsible}');
		});

		it('still shows the raw text on a backend that does not send renderedPrivacy', async () => {
			vi.mocked(fetchData).mockResolvedValue(null);
			mockTenant.content.privacy = '<p>Nur roher Trägertext</p>';

			render(
				<DepartmentLegalSection
					agency={agencyWithDepartment}
					topic={topic}
					variant="consent"
				/>
			);

			expandSection();

			await waitFor(() =>
				expect(screen.getByText('Nur roher Trägertext')).toBeDefined()
			);
		});
	});
	/* eslint-enable no-template-curly-in-string */

	it('shows an unavailable notice when neither department nor tenant content exists', async () => {
		vi.mocked(fetchData).mockRejectedValue(new Error('NO_MATCH'));
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
