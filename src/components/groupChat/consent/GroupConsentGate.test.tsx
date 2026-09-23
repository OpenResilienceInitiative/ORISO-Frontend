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
import { GroupConsentGate } from './GroupConsentGate';

vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('focus-trap-react', () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const apiGetAgencyById = vi.fn();
vi.mock('../../../api/apiGetAgencyId', () => ({
	apiGetAgencyById: (...args: unknown[]) => apiGetAgencyById(...args)
}));

const apiGetConsentText = vi.fn();
vi.mock('../../../api/apiGetConsentText', () => ({
	apiGetConsentText: (...args: unknown[]) => apiGetConsentText(...args)
}));

const apiPatchUserData = vi.fn(() => Promise.resolve());
vi.mock('../../../api/apiPatchUserData', () => ({
	apiPatchUserData: (...args: unknown[]) => (apiPatchUserData as any)(...args)
}));

/**
 * # Gate 2 of ADR-022 in a self-help group (#1499)
 *
 * Before the first message a client agrees to the statement of the
 * Beratungsstelle that runs the group. The agreement is recorded on the
 * account, the way the live chat's gate records it.
 */
beforeEach(() => {
	apiGetAgencyById.mockResolvedValue({ id: 19, topicIds: [17] });
	apiGetConsentText.mockResolvedValue({
		status: 'ok',
		consentText: {
			sentence:
				'Ich habe die Datenschutzerklärung der Beratungstelle gelesen.',
			versionId: 5
		}
	});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('GroupConsentGate', () => {
	it("shows the Beratungsstelle's own sentence and speaks about the group", async () => {
		render(<GroupConsentGate agencyId={19} onAccepted={() => undefined} />);

		expect(
			await screen.findByText(
				'Ich habe die Datenschutzerklärung der Beratungstelle gelesen.'
			)
		).toBeTruthy();
		expect(apiGetConsentText).toHaveBeenCalledWith(19, 17);
		expect(screen.getByRole('dialog').textContent).toContain('Gruppe');
		expect(screen.getByRole('dialog').textContent).not.toContain(
			'beratende Person einen Chat'
		);
	});

	it('records the agreement on the account, then lets the client in', async () => {
		const onAccepted = vi.fn();
		render(<GroupConsentGate agencyId={19} onAccepted={onAccepted} />);
		await screen.findByText(
			'Ich habe die Datenschutzerklärung der Beratungstelle gelesen.'
		);

		fireEvent.click(screen.getByRole('button', { name: 'Einverstanden' }));

		await waitFor(() => expect(onAccepted).toHaveBeenCalled());
		expect(apiPatchUserData).toHaveBeenCalledWith({
			dataPrivacyConfirmation: true,
			termsAndConditionsConfirmation: true
		});
	});

	it('keeps the gate when the agreement cannot be recorded', async () => {
		apiPatchUserData.mockImplementationOnce(() =>
			Promise.reject(new Error('offline'))
		);
		const onAccepted = vi.fn();
		render(<GroupConsentGate agencyId={19} onAccepted={onAccepted} />);
		await screen.findByText(
			'Ich habe die Datenschutzerklärung der Beratungstelle gelesen.'
		);

		fireEvent.click(screen.getByRole('button', { name: 'Einverstanden' }));

		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalled());
		expect(onAccepted).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeTruthy();
	});

	it('falls back to the platform sentence when the topic cannot be told', async () => {
		apiGetAgencyById.mockResolvedValue({ id: 19, topicIds: [17, 18] });
		render(<GroupConsentGate agencyId={19} onAccepted={() => undefined} />);

		await waitFor(() =>
			expect(screen.getByRole('dialog').textContent).toContain(
				'zur Kenntnis genommen'
			)
		);
		expect(apiGetConsentText).not.toHaveBeenCalled();
	});
});
