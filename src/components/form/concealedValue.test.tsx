// @vitest-environment oriso-jsdom
import * as React from 'react';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { OrisoTextField } from './OrisoTextField';
import { InputField } from '../inputField/InputField';
import { AccountSetupField } from '../twoFactorAuth/accountSetupDialogChrome';

// FE#2582: React DOM mirrors the value of a controlled input into its HTML
// `value` attribute, so a typed password ended up readable in the page HTML.
// Secret fields must keep what was typed out of every attribute.
const SECRET = 'Probe-Secret-2582';

const expectNotInHtml = (input: HTMLInputElement) => {
	expect(input.getAttribute('value') ?? '').not.toContain('Probe');
	expect(document.documentElement.outerHTML).not.toContain('Probe');
};

const ControlledTextField = ({
	type = 'password',
	autoComplete,
	filter
}: {
	type?: string;
	autoComplete?: string;
	filter?: (value: string) => string;
}) => {
	const [value, setValue] = useState('');
	const [visible, setVisible] = useState(false);
	return (
		<>
			<OrisoTextField
				id="secret"
				label="Secret"
				type={type === 'password' && visible ? 'text' : type}
				autoComplete={autoComplete}
				value={value}
				onChange={(event) =>
					setValue(
						filter ? filter(event.target.value) : event.target.value
					)
				}
			/>
			<button type="button" onClick={() => setVisible(!visible)}>
				toggle
			</button>
			<button type="button" onClick={() => setValue('')}>
				clear
			</button>
			<output data-testid="state">{value.length}</output>
		</>
	);
};

const LegacyPasswordField = () => {
	const [content, setContent] = useState('');
	return (
		<InputField
			item={{
				id: 'passwordInput',
				type: 'password',
				name: 'password',
				label: 'Passwort',
				content
			}}
			inputHandle={(event) => setContent(event.target.value)}
		/>
	);
};

const SetupOtpField = () => {
	const [otp, setOtp] = useState('');
	return (
		<AccountSetupField
			id="otp"
			label="Code"
			name="otp"
			autoComplete="one-time-code"
			onChange={(event) => setOtp(event.target.value)}
			value={otp}
		/>
	);
};

describe('secret inputs keep typed values out of the HTML (FE#2582)', () => {
	afterEach(cleanup);

	it('OrisoTextField type=password: typed text is in .value, not in the attribute', async () => {
		render(<ControlledTextField />);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		await userEvent.type(input, SECRET);
		expect(input.value).toBe(SECRET);
		expect(screen.getByTestId('state').textContent).toBe(
			String(SECRET.length)
		);
		expectNotInHtml(input);
	});

	it('stays concealed after the show-password toggle switches to type=text', async () => {
		render(<ControlledTextField />);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		await userEvent.type(input, 'Probe');
		fireEvent.click(screen.getByText('toggle'));
		expect(input.type).toBe('text');
		await userEvent.type(input, '-more');
		expect(input.value).toBe('Probe-more');
		expectNotInHtml(input);
	});

	it('follows a value the parent sets, e.g. clearing the field', async () => {
		render(<ControlledTextField />);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		await userEvent.type(input, SECRET);
		fireEvent.click(screen.getByText('clear'));
		expect(input.value).toBe('');
	});

	it('restores the parent value when the parent rejects a keystroke', async () => {
		render(
			<ControlledTextField
				type="text"
				autoComplete="one-time-code"
				filter={(value) => value.replace(/\D/g, '')}
			/>
		);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		await userEvent.type(input, '12a3');
		expect(input.value).toBe('123');
		expect(input.getAttribute('value') ?? '').not.toContain('12');
	});

	it('leaves ordinary text fields controlled as before', async () => {
		render(<ControlledTextField type="text" />);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		await userEvent.type(input, 'hello');
		expect(input.value).toBe('hello');
		expect(input.getAttribute('value')).toBe('hello');
	});

	it('legacy InputField password (sign-in page) keeps the password out of the HTML', async () => {
		render(<LegacyPasswordField />);
		const input = document.getElementById(
			'passwordInput'
		) as HTMLInputElement;
		await userEvent.type(input, SECRET);
		expect(input.value).toBe(SECRET);
		expectNotInHtml(input);
	});

	it('AccountSetupField one-time code keeps the code out of the HTML', async () => {
		render(<SetupOtpField />);
		const input = screen.getByLabelText('Code') as HTMLInputElement;
		await userEvent.type(input, 'Probe1');
		expect(input.value).toBe('Probe1');
		expectNotInHtml(input);
	});
});
