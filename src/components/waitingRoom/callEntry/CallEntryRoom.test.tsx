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
		onUsernameChange
	}: CallEntryIdentityProps) => (
		<input
			aria-label="User-ID"
			value={username}
			onChange={(event) => onUsernameChange(event.target.value)}
		/>
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
