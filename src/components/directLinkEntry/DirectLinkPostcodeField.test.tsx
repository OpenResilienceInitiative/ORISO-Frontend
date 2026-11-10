// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { DirectLinkPostcodeField } from './DirectLinkPostcodeField';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

describe('DirectLinkPostcodeField (ORISO-Frontend#1795)', () => {
	afterEach(cleanup);

	it('takes digits only, at most five', () => {
		const onChange = vi.fn();
		render(<DirectLinkPostcodeField value="" onChange={onChange} />);
		fireEvent.change(screen.getByLabelText('registration.zipcode.label'), {
			target: { value: '10a115 99' }
		});
		expect(onChange).toHaveBeenCalledWith('10115');
	});

	it('says what the postcode is for', () => {
		render(<DirectLinkPostcodeField value="" onChange={() => undefined} />);
		expect(screen.getByText('directLink.postcode.helper')).toBeTruthy();
	});

	it('flags an incomplete postcode only after the field was left', () => {
		render(
			<DirectLinkPostcodeField value="101" onChange={() => undefined} />
		);
		const input = screen.getByLabelText('registration.zipcode.label');
		expect(input.getAttribute('aria-invalid')).toBe('false');
		fireEvent.blur(input);
		expect(input.getAttribute('aria-invalid')).toBe('true');
	});
});
