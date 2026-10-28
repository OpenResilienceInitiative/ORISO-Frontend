// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values ? `${key}(${JSON.stringify(values)})` : key
	})
}));

const { CallAdmissionToggle } = await import('./CallAdmissionToggle');
const {
	admissionToKnock,
	createMemoryCallAdmissionStore,
	DEFAULT_CALL_ADMISSION,
	knockToAdmission
} = await import('./callAdmission');
const { CallParticipantsButton } = await import(
	'../knockNotice/CallParticipantsButton'
);

afterEach(cleanup);

const theSwitch = () =>
	screen.getByRole('switch', {
		name: 'calls.admission.label'
	}) as HTMLInputElement;

describe('call admission (#1892 scope extension)', () => {
	it('maps the share popover flag to the UserService value both ways', () => {
		expect(knockToAdmission(true)).toBe('KNOCK');
		expect(knockToAdmission(false)).toBe('DIRECT');
		expect(admissionToKnock('KNOCK')).toBe(true);
		expect(admissionToKnock('DIRECT')).toBe(false);
		expect(DEFAULT_CALL_ADMISSION).toBe('KNOCK');
	});

	it('starts on and says guests wait', () => {
		render(
			<CallAdmissionToggle store={createMemoryCallAdmissionStore()} />
		);
		expect(theSwitch().checked).toBe(true);
		expect(screen.getByText('calls.admission.on')).toBeTruthy();
	});

	it('turns knocking off from the keyboard and stores it', async () => {
		const store = createMemoryCallAdmissionStore('KNOCK');
		const seen = vi.fn();
		store.watch(seen);
		render(<CallAdmissionToggle store={store} />);
		theSwitch().focus();
		await userEvent.keyboard(' ');
		await waitFor(() => expect(theSwitch().checked).toBe(false));
		expect(seen).toHaveBeenLastCalledWith('DIRECT');
		expect(screen.getByText('calls.admission.off')).toBeTruthy();
	});

	it('follows a change made elsewhere, e.g. in the share popover', async () => {
		const store = createMemoryCallAdmissionStore('KNOCK');
		render(<CallAdmissionToggle store={store} />);
		await act(() => store.set('DIRECT'));
		expect(theSwitch().checked).toBe(false);
	});

	it('keeps the stored value when saving fails', async () => {
		const memory = createMemoryCallAdmissionStore('KNOCK');
		const set = vi.fn().mockRejectedValue(new Error('CATCH_ALL'));
		render(<CallAdmissionToggle store={{ watch: memory.watch, set }} />);
		await userEvent.click(theSwitch());
		await waitFor(() => expect(theSwitch().disabled).toBe(false));
		expect(set).toHaveBeenCalledWith('DIRECT');
		expect(theSwitch().checked).toBe(true);
	});
});

describe('CallParticipantsButton', () => {
	it('names the waiting count', () => {
		render(<CallParticipantsButton waiting={2} />);
		expect(
			screen.getByRole('button', {
				name: 'calls.knock.participantsWaiting({"count":2})'
			})
		).toBeTruthy();
	});

	it('is just "participants" when nobody waits', () => {
		render(<CallParticipantsButton waiting={0} />);
		expect(
			screen.getByRole('button', { name: 'calls.knock.participants' })
		).toBeTruthy();
	});
});
