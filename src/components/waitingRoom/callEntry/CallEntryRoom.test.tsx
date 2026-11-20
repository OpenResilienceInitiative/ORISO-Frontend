// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CallEntryRoom } from './CallEntryRoom';
import type { CallEntryRoomProps } from './CallEntryRoom';
import type { CallEntryIdentityProps } from './CallEntryIdentity';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { resolvedLanguage: 'de' }
	})
}));
vi.mock('../../anonymousChat/entryRoom/EntryRoomShell', () => ({
	EntryRoomShell: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	)
}));
vi.mock('../WaitingRoomBar', () => ({ WaitingRoomBar: () => null }));
vi.mock('../WaitingRoomConsent', () => ({
	useWaitingRoomConsent: () => ({ check: () => true }),
	WaitingRoomConsentPanel: () => null
}));
vi.mock('../useConsentSentences', () => ({
	useConsentSentences: () => ({ platformHtml: '' })
}));
vi.mock('../../registration/accountData/useUsernameAvailability', () => ({
	useUsernameAvailability: () => ({
		checked: true,
		isAvailable: true,
		failed: false
	})
}));
vi.mock('./VideoCheck', () => ({ VideoCheck: () => null }));
vi.mock('./VoiceCheck', () => ({ VoiceCheck: () => null }));
vi.mock('./DevicePicker', () => ({ DevicePicker: () => null }));
vi.mock('./SpeakerTest', () => ({ SpeakerTest: () => null }));
vi.mock('./CallEntryIdentity', () => ({
	CallEntryIdentity: ({
		username,
		onUsernameChange,
		hidePassword,
		password
	}: CallEntryIdentityProps) => (
		<>
			<input
				aria-label="User-ID"
				value={username}
				onChange={(event) => onUsernameChange(event.target.value)}
			/>
			{!hidePassword && (
				<input aria-label="Passwort" value={password} readOnly />
			)}
		</>
	)
}));

const room = (usernameEditable: boolean) => (
	<CallEntryRoom
		{...({
			modality: 'video',
			devices: { camera: [], microphone: [], speaker: [] },
			micLevel: 0,
			onJoin: () => undefined,
			usernameEditable
		} as unknown as CallEntryRoomProps)}
	/>
);
const field = () => screen.getByLabelText<HTMLInputElement>('User-ID');

describe('the User-ID in the call entry room', () => {
	afterEach(cleanup);

	it('replaces a typed name when typing closes', () => {
		const { rerender } = render(room(true));
		fireEvent.change(field(), { target: { value: 'mein_name' } });
		expect(field().value).toBe('mein_name');

		rerender(room(false));

		expect(field().value).toMatch(/^[a-z0-9_]+_[1-9][0-9]{3}$/);
	});

	it('keeps a typed name while typing stays open', () => {
		const { rerender } = render(room(true));
		fireEvent.change(field(), { target: { value: 'mein_name' } });

		rerender(room(true));

		expect(field().value).toBe('mein_name');
	});

	it('keeps the suggestion when typing opens', () => {
		const { rerender } = render(room(false));
		const suggested = field().value;

		rerender(room(true));

		expect(field().value).toBe(suggested);
	});
});

/* UserService#1662: a link whose mode lets the guest choose. */
describe('the account choice in the call entry room', () => {
	afterEach(cleanup);

	const choiceRoom = (temporary: boolean, onToggle = vi.fn()) => (
		<CallEntryRoom
			{...({
				modality: 'video',
				devices: { camera: [], microphone: [], speaker: [] },
				micLevel: 0,
				onJoin: () => undefined,
				hidePassword: temporary,
				accountChoice: { temporary, onToggle }
			} as unknown as CallEntryRoomProps)}
		/>
	);

	it('offers an account while joining without one, and says what that means', () => {
		const onToggle = vi.fn();
		render(choiceRoom(true, onToggle));
		expect(
			screen.getByText('guestAccountMode.entry.temporaryNote')
		).toBeTruthy();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'guestAccountMode.entry.withAccount'
			})
		);
		expect(onToggle).toHaveBeenCalledOnce();
	});

	it('offers to join without an account once the guest chose one', () => {
		render(choiceRoom(false));
		expect(
			screen.getByText('guestAccountMode.entry.accountNote')
		).toBeTruthy();
		expect(
			screen.getByRole('button', {
				name: 'guestAccountMode.entry.withoutAccount'
			})
		).toBeTruthy();
	});

	it('shows no choice without one', () => {
		render(room(true));
		expect(
			screen.queryByRole('button', { name: /guestAccountMode.entry/ })
		).toBeNull();
	});

	it('keeps a working password when the field hides again', () => {
		const { rerender } = render(choiceRoom(false));
		const typed = screen.getByLabelText<HTMLInputElement>('Passwort');
		expect(typed.value).toBe('');
		rerender(choiceRoom(true));
		rerender(choiceRoom(false));
		expect(
			screen.getByLabelText<HTMLInputElement>('Passwort').value.length
		).toBeGreaterThanOrEqual(16);
	});
});
