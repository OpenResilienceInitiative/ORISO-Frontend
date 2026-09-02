// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPutEmail = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'furtherSteps.email.overlay.input.label': 'E-Mail',
			'furtherSteps.email.overlay.input.unavailable':
				'Diese E-Mail-Adresse ist bereits registriert.',
			'furtherSteps.email.overlay.button1.label': 'Speichern',
			'furtherSteps.email.overlay.button2.label': 'Schließen',
			'furtherSteps.email.overlay.headline': 'E-Mail-Adresse angeben',
			'furtherSteps.email.success.overlay.headline':
				'Ihre E-Mail-Adresse wurde erfolgreich gespeichert.',
			'erstantwort.emailNotification.saveFailed':
				'Speichern hat nicht geklappt. Bitte versuchen Sie es noch einmal.'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
}));

vi.mock('../../api', () => ({
	apiPutEmail: (...args: unknown[]) => apiPutEmail(...args),
	FETCH_ERRORS: { X_REASON: 'X-Reason' },
	X_REASON: { EMAIL_NOT_AVAILABLE: 'EMAIL_NOT_AVAILABLE' }
}));

/* The platform Overlay portals into a modal root and installs a focus trap.
   Neither is what this test is about — it is about the form wiring: validation,
   submit, and how each failure reaches the person. Stub the chrome, keep the
   buttonSet contract (label / disabled / function) that the real one honours. */
vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE' },
	Overlay: ({ item, handleOverlay }: any) => (
		<div>
			<h2>{item.headline}</h2>
			{item.copy && <p>{item.copy}</p>}
			{item.nestedComponent}
			{item.buttonSet?.map((button: any) => (
				<button
					key={button.label}
					disabled={button.disabled}
					onClick={() => handleOverlay(button.function)}
				>
					{button.label}
				</button>
			))}
		</div>
	)
}));

/* `vi.mock` factories are hoisted above every const in the module, so the
   factory has to be inlined rather than referenced by name. */
vi.mock('../../resources/img/icons/envelope.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));
vi.mock('../../resources/img/illustrations/envelope-check.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));
vi.mock('../../resources/img/illustrations/check.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));

/* eslint-disable-next-line import/first -- must be imported after the vi.mock
   calls above, otherwise the real Overlay and SVG modules load first. */
import { ErstantwortEmailOverlay } from './ErstantwortEmailOverlay';

afterEach(cleanup);
beforeEach(() => {
	apiPutEmail.mockReset();
	apiPutEmail.mockResolvedValue(undefined);
});

const type = (value: string) =>
	fireEvent.change(screen.getByRole('textbox'), { target: { value } });

const saveButton = () => screen.getByRole('button', { name: 'Speichern' });

describe('ErstantwortEmailOverlay', () => {
	it('keeps saving disabled until the address is a valid one', () => {
		render(<ErstantwortEmailOverlay onClose={vi.fn()} onSaved={vi.fn()} />);

		expect(saveButton().hasAttribute('disabled')).toBe(true);

		type('nope');
		expect(saveButton().hasAttribute('disabled')).toBe(true);

		type('jemand@example.test');
		expect(saveButton().hasAttribute('disabled')).toBe(false);
	});

	it('submits the address and reports success', async () => {
		const onSaved = vi.fn();
		render(<ErstantwortEmailOverlay onClose={vi.fn()} onSaved={onSaved} />);

		type('jemand@example.test');
		await act(async () => {
			saveButton().click();
		});

		expect(apiPutEmail).toHaveBeenCalledWith('jemand@example.test');
		expect(onSaved).toHaveBeenCalled();
		expect(
			screen.getByText(
				'Ihre E-Mail-Adresse wurde erfolgreich gespeichert.'
			)
		).toBeTruthy();
	});

	it('surfaces an already-registered address instead of failing silently', async () => {
		apiPutEmail.mockRejectedValue({
			headers: { get: () => 'EMAIL_NOT_AVAILABLE' }
		});
		render(<ErstantwortEmailOverlay onClose={vi.fn()} onSaved={vi.fn()} />);

		type('jemand@example.test');
		await act(async () => {
			saveButton().click();
		});

		/* InputField renders its label twice (the MUI floating label plus a
		   visually-hidden span), so the count is the component's, not ours. */
		expect(
			screen.getAllByText('Diese E-Mail-Adresse ist bereits registriert.')
				.length
		).toBeGreaterThan(0);
	});

	it('reports an unexpected failure rather than leaving the dialog stuck', async () => {
		/* The FurtherSteps overlay this replaces swallowed every error that was
		   not EMAIL_NOT_AVAILABLE: `isRequestInProgress` stayed true, so the
		   save button was dead for the rest of the session with no explanation. */
		apiPutEmail.mockRejectedValue({ headers: { get: () => null } });
		render(<ErstantwortEmailOverlay onClose={vi.fn()} onSaved={vi.fn()} />);

		type('jemand@example.test');
		await act(async () => {
			saveButton().click();
		});

		expect(
			screen.getAllByText(
				'Speichern hat nicht geklappt. Bitte versuchen Sie es noch einmal.'
			).length
		).toBeGreaterThan(0);
		expect(saveButton().hasAttribute('disabled')).toBe(false);
	});

	it('closes on the close button', () => {
		const onClose = vi.fn();
		render(<ErstantwortEmailOverlay onClose={onClose} onSaved={vi.fn()} />);

		screen.getByRole('button', { name: 'Schließen' }).click();
		expect(onClose).toHaveBeenCalled();
	});
});
