// @vitest-environment jsdom
import * as React from 'react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import enCommon from '../../resources/i18n/en/common.json';
import { Input } from './input';

const i18n = i18next.createInstance();

beforeAll(async () => {
	await i18n.init({
		lng: 'en',
		fallbackLng: 'en',
		resources: {
			en: {
				translation: enCommon
			}
		}
	});
});

describe('Input password criteria accessibility', () => {
	it('announces fulfilled criteria with the existing localized prefix', () => {
		render(
			<I18nextProvider i18n={i18n}>
				<Input
					label="Password"
					value="Abcdefg1!"
					onInputChange={() => undefined}
					multipleCriteria={[
						{
							info: 'registration.account.password.criteria1',
							validation: () => true
						},
						{
							info: 'registration.account.password.criteria2',
							validation: () => false
						}
					]}
				/>
			</I18nextProvider>
		);

		expect(screen.getByText(/fulfilled\s*:/i)).toBeTruthy();
		expect(
			screen.queryByText(
				/registration\.account\.password\.criteria\.fulfilled/i
			)
		).toBeNull();
	});
});
