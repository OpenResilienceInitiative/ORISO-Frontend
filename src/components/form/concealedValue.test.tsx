// @vitest-environment oriso-jsdom
import * as React from 'react';
import { useState } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { OrisoTextField } from './OrisoTextField';
import { InputField } from '../inputField/InputField';
import { AccountSetupField } from '../twoFactorAuth/accountSetupDialogChrome';
import { isSecretField, useConcealedValue } from './ConcealedValueInput';
import { RecoveryKeyField } from '../profile/EncryptionSettings/RecoveryKeyField';

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
	filter,
	initialValue = ''
}: {
	type?: string;
	autoComplete?: string;
	filter?: (value: string) => string;
	initialValue?: string;
}) => {
	const [value, setValue] = useState(initialValue);
	const [, setRenders] = useState(0);
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
			<button type="button" onClick={() => setRenders((n) => n + 1)}>
				rerender
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

const RecoveryKey = () => {
	const [key, setKey] = useState('');
	return <RecoveryKeyField value={key} onChange={setKey} />;
};

describe('secret inputs keep typed values out of the HTML (FE#2582)', () => {
	let consoleError: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		consoleError = vi.spyOn(console, 'error');
	});
	afterEach(() => {
		// No controlled/uncontrolled switch, ref or key warnings from React/MUI.
		expect(consoleError).not.toHaveBeenCalled();
		consoleError.mockRestore();
		cleanup();
	});

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

	it('shows a value the parent starts with, without putting it in the HTML', () => {
		render(<ControlledTextField initialValue="Probe-initial" />);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		expect(input.value).toBe('Probe-initial');
		expectNotInHtml(input);
	});

	it('matches the parent state again on the next render after a DOM-only change', async () => {
		render(<ControlledTextField />);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		await userEvent.type(input, 'Probe');
		input.value = 'changed-outside-react';
		fireEvent.click(screen.getByText('rerender'));
		expect(input.value).toBe('Probe');
	});

	it('RecoveryKeyField keeps the recovery key out of the HTML', async () => {
		render(<RecoveryKey />);
		const input = document.querySelector(
			'[data-cy="recovery-key-input"]'
		) as HTMLInputElement;
		await userEvent.type(input, 'Probe-key');
		expect(input.value).toBe('Probe-key');
		expectNotInHtml(input);
	});

	it('recognizes autocomplete token lists and any letter case', () => {
		expect(isSecretField('text', 'section-login one-time-code')).toBe(true);
		expect(isSecretField('text', 'ONE-TIME-CODE')).toBe(true);
		expect(isSecretField('text', 'shipping  Current-Password')).toBe(true);
		expect(isSecretField('text', 'section-login username')).toBe(false);
		expect(isSecretField('text', 'off')).toBe(false);
		expect(isSecretField('text', undefined)).toBe(false);
		expect(isSecretField('password', 'off')).toBe(true);
	});

	it('conceals a prefixed, uppercase one-time-code field', async () => {
		render(
			<ControlledTextField
				type="text"
				autoComplete="section-login ONE-TIME-CODE"
			/>
		);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		await userEvent.type(input, 'Probe7');
		expect(input.value).toBe('Probe7');
		expectNotInHtml(input);
	});

	it('useConcealedValue latches on and stays on when the type turns to text', () => {
		const { result, rerender } = renderHook(
			({ type }: { type: string }) => useConcealedValue(type, 'off'),
			{ initialProps: { type: 'text' } }
		);
		expect(result.current).toBe(false);
		rerender({ type: 'password' });
		expect(result.current).toBe(true);
		rerender({ type: 'text' });
		expect(result.current).toBe(true);
	});

	it('uncontrolled: starts from defaultValue without the attribute and stays editable', async () => {
		const onChange = vi.fn();
		render(
			<OrisoTextField
				label="Secret"
				type="password"
				defaultValue="Probe-default"
				onChange={onChange}
			/>
		);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		expect(input.value).toBe('Probe-default');
		await userEvent.type(input, 'X');
		expect(input.value).toBe('Probe-defaultX');
		expect(onChange).toHaveBeenCalledTimes(1);
		expectNotInHtml(input);
	});

	it('uncontrolled without any value: typing is kept', async () => {
		render(<OrisoTextField label="Secret" type="password" />);
		const input = screen.getByLabelText('Secret') as HTMLInputElement;
		await userEvent.type(input, 'Probe');
		expect(input.value).toBe('Probe');
		expectNotInHtml(input);
	});
});
