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
import { ContactSheetRequest } from './ContactSheetRequest';
import { apiRequestContactSheetEmail } from '../../api/apiRequestContactSheetEmail';

vi.mock('../../api/apiRequestContactSheetEmail', () => ({
	apiRequestContactSheetEmail: vi.fn()
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { email?: string }) =>
			options?.email ? `${key}: ${options.email}` : key
	})
}));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe('contact-sheet request', () => {
	it('requires an address and makes no request on render', () => {
		render(<ContactSheetRequest sessionId={42} />);
		expect(screen.getByRole('button')).toHaveProperty('disabled', true);
		expect(screen.getByText('contactSheet.missingEmail')).toBeTruthy();
		expect(apiRequestContactSheetEmail).not.toHaveBeenCalled();
	});

	it('sends once per deliberate click and shows the recipient', async () => {
		vi.mocked(apiRequestContactSheetEmail).mockResolvedValue(undefined);
		render(
			<ContactSheetRequest sessionId={42} email=" seeker@example.org " />
		);
		expect(
			screen.getByText('contactSheet.recipient: seeker@example.org')
		).toBeTruthy();
		expect(apiRequestContactSheetEmail).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button'));
		await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
		expect(apiRequestContactSheetEmail).toHaveBeenCalledExactlyOnceWith(42);

		fireEvent.click(screen.getByRole('button'));
		await waitFor(() =>
			expect(apiRequestContactSheetEmail).toHaveBeenCalledTimes(2)
		);
	});

	it('shows a failed send instead of a success', async () => {
		vi.mocked(apiRequestContactSheetEmail).mockRejectedValue(
			new Error('SMTP failed')
		);
		render(
			<ContactSheetRequest sessionId={42} email="seeker@example.org" />
		);
		fireEvent.click(screen.getByRole('button'));
		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect(screen.queryByRole('status')).toBeNull();
	});
});
