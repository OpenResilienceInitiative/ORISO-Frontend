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

describe('the postcode in the call entry identity (ORISO-Frontend#1795)', () => {
	afterEach(cleanup);

	const renderPostcode = (askPostcode?: boolean) => {
		const onPostcodeChange = vi.fn();
		render(
			<CallEntryIdentity
				modality="video"
				identity={identity as never}
				onIdentityChange={() => undefined}
				username="eule_mika_4821"
				onUsernameChange={() => undefined}
				password=""
				onPasswordChange={() => undefined}
				askPostcode={askPostcode}
				postcode="10"
				onPostcodeChange={onPostcodeChange}
			/>
		);
		return { onPostcodeChange };
	};

	it('shows the field for a registered account and reports what is typed', () => {
		const { onPostcodeChange } = renderPostcode(true);
		fireEvent.change(screen.getByLabelText('registration.zipcode.label'), {
			target: { value: '10115' }
		});
		expect(onPostcodeChange).toHaveBeenCalledWith('10115');
	});

	it('shows no field when the account is temporary', () => {
		renderPostcode(false);
		expect(
			screen.queryByLabelText('registration.zipcode.label')
		).toBeNull();
	});
});
