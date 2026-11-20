// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { getCachedDepartmentLegalOutcome } from '../../../api/apiGetDepartmentLegal';
import { usePrivacyNoticeGuard } from './usePrivacyNoticeGuard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../api/apiGetDepartmentLegal', () => ({
	getCachedDepartmentLegalOutcome: vi.fn()
}));

const legal = (content: string | null) => ({
	status: 'ok' as const,
	data: {
		dpp: { content, consentText: null },
		imprint: { content: null, consentText: null }
	}
});

const agree = () => screen.getByLabelText('agree') as HTMLInputElement;

const Harness = ({ accepted = false }: { accepted?: boolean }) => {
	const [checked, setChecked] = React.useState(accepted);
	const { guardToggle, dialog } = usePrivacyNoticeGuard(3, 14);
	return (
		<>
			<input
				type="checkbox"
				aria-label="agree"
				checked={checked}
				onChange={() =>
					guardToggle(() => setChecked((c) => !c), checked)
				}
			/>
			{dialog}
		</>
	);
};

describe('usePrivacyNoticeGuard', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(() => cleanup());

	it('ticks straight away when a privacy notice is stored', async () => {
		vi.mocked(getCachedDepartmentLegalOutcome).mockResolvedValue(
			legal('{"de":"<p>Text</p>"}')
		);
		render(<Harness />);
		await userEvent.click(screen.getByLabelText('agree'));
		expect(agree().checked).toBe(true);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('warns first when no privacy notice is stored, and ticks only on continue', async () => {
		vi.mocked(getCachedDepartmentLegalOutcome).mockResolvedValue(
			legal(null)
		);
		render(<Harness />);
		await waitFor(() =>
			expect(getCachedDepartmentLegalOutcome).toHaveBeenCalled()
		);
		await userEvent.click(screen.getByLabelText('agree'));
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(agree().checked).toBe(false);

		await userEvent.click(
			screen.getByText('registration.dataProtection.noNotice.continue')
		);
		expect(agree().checked).toBe(true);
	});

	it('leaves the box unticked when the person cancels the warning', async () => {
		vi.mocked(getCachedDepartmentLegalOutcome).mockResolvedValue(
			legal(null)
		);
		render(<Harness />);
		await waitFor(() =>
			expect(getCachedDepartmentLegalOutcome).toHaveBeenCalled()
		);
		await userEvent.click(screen.getByLabelText('agree'));
		await userEvent.click(
			screen.getByText('registration.dataProtection.noNotice.cancel')
		);
		expect(agree().checked).toBe(false);
	});

	it('does not warn when the lookup failed', async () => {
		vi.mocked(getCachedDepartmentLegalOutcome).mockResolvedValue({
			status: 'unavailable'
		});
		render(<Harness />);
		await userEvent.click(screen.getByLabelText('agree'));
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('does not warn when unticking', async () => {
		vi.mocked(getCachedDepartmentLegalOutcome).mockResolvedValue(
			legal(null)
		);
		render(<Harness accepted />);
		await waitFor(() =>
			expect(getCachedDepartmentLegalOutcome).toHaveBeenCalled()
		);
		await userEvent.click(screen.getByLabelText('agree'));
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(agree().checked).toBe(false);
	});
});
