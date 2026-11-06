// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CallEntryIdentity } from './CallEntryIdentity';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { resolvedLanguage: 'de' }
	})
}));
vi.mock('../../pseudonym/AnimalAvatar', () => ({ AnimalAvatar: () => null }));

const identity = {
	displayName: 'freundliche Eule Mika',
	animalLabel: 'Eule',
	name: 'Mika',
	avatar: { file: 'owl.svg', bg: '#eee', iconColor: '#333' }
};

const renderIdentity = (usernameEditable?: boolean) => {
	const onUsernameChange = vi.fn();
	render(
		<CallEntryIdentity
			modality="video"
			identity={identity as never}
			onIdentityChange={() => undefined}
			username="eule_mika_4821"
			onUsernameChange={onUsernameChange}
			password=""
			onPasswordChange={() => undefined}
			usernameEditable={usernameEditable}
		/>
	);
	return {
		onUsernameChange,
		field: screen.getByLabelText('registration.account.username.label')
	};
};

describe('CallEntryIdentity', () => {
	afterEach(cleanup);

	it('takes a typed User-ID by default', () => {
		const { field, onUsernameChange } = renderIdentity();
		expect(field.hasAttribute('readonly')).toBe(false);
		fireEvent.change(field, { target: { value: 'Mein_Name' } });
		expect(onUsernameChange).toHaveBeenCalledWith('mein_name');
	});

	it('leaves only the suggestion when typing is off', () => {
		const { field, onUsernameChange } = renderIdentity(false);
		expect(field.hasAttribute('readonly')).toBe(true);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'registration.account.suggest.username'
			})
		);
		expect(onUsernameChange).toHaveBeenCalledWith(
			expect.stringMatching(/^[a-z0-9_]+_[1-9][0-9]{3}$/)
		);
	});
});
