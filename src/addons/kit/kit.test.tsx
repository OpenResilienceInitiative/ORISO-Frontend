// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { webKit } from '.';
import { ADDON_SHARED_GLOBAL, installAddonShared } from '../addonShared';

const {
	Button,
	Headline,
	TextField,
	Checkbox,
	RadioGroup,
	DatePicker,
	NumberField
} = webKit;

describe('web kit', () => {
	it('renders button text as given, without treating it as a translation key', () => {
		const onClick = vi.fn();
		render(<Button onClick={onClick}>Teil 2: Weiter</Button>);

		fireEvent.click(screen.getByRole('button', { name: 'Teil 2: Weiter' }));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('submits the surrounding form with a submit button, and only then', () => {
		const onSubmit = vi.fn((event: React.FormEvent) =>
			event.preventDefault()
		);
		render(
			<form onSubmit={onSubmit}>
				<Button>Abbrechen</Button>
				<Button type="submit">Speichern</Button>
			</form>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
		expect(onSubmit).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it('renders headline text as text, never as HTML', () => {
		const { container } = render(
			<Headline level={3}>{'<img src=x onerror=alert(1)>'}</Headline>
		);

		expect(container.querySelector('img')).toBeNull();
		expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
			'<img src=x onerror=alert(1)>'
		);
	});

	it('reports text field and checkbox changes as plain values', () => {
		const onText = vi.fn();
		const onCheck = vi.fn();
		render(
			<>
				<TextField label="Name" value="" onChange={onText} />
				<Checkbox label="Teilen" checked={false} onChange={onCheck} />
			</>
		);

		fireEvent.change(screen.getByLabelText('Name'), {
			target: { value: 'Alex' }
		});
		fireEvent.click(screen.getByLabelText('Teilen'));

		expect(onText).toHaveBeenCalledWith('Alex');
		expect(onCheck).toHaveBeenCalledWith(true);
	});

	it('reports the chosen radio option and keeps disabled options out of reach', () => {
		const onChange = vi.fn();
		render(
			<RadioGroup
				label="Kontakt"
				value="chat"
				onChange={onChange}
				helperText="Später änderbar"
				options={[
					{ value: 'chat', label: 'Im Chat' },
					{ value: 'call', label: 'Per Anruf' },
					{ value: 'visit', label: 'Vor Ort', disabled: true }
				]}
			/>
		);

		const describedBy = screen
			.getByRole('radiogroup')
			.getAttribute('aria-describedby');
		expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
			'Später änderbar'
		);
		expect(screen.getByRole('group', { name: 'Kontakt' })).toBeTruthy();
		expect(
			(screen.getByLabelText('Im Chat') as HTMLInputElement).checked
		).toBe(true);
		expect(
			(screen.getByLabelText('Vor Ort') as HTMLInputElement).disabled
		).toBe(true);

		fireEvent.click(screen.getByLabelText('Per Anruf'));

		expect(onChange).toHaveBeenCalledWith('call');
	});

	it('takes and reports dates as YYYY-MM-DD', () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<DatePicker label="Beginn" value="2026-03-05" onChange={onChange} />
		);

		const input = screen.getByLabelText('Beginn') as HTMLInputElement;
		expect(input.value).toBe('05.03.2026');

		fireEvent.change(input, { target: { value: '24.12.2026' } });
		fireEvent.blur(input);
		expect(onChange).toHaveBeenLastCalledWith('2026-12-24');

		fireEvent.change(input, { target: { value: '' } });
		fireEvent.blur(input);
		expect(onChange).toHaveBeenLastCalledWith('');

		rerender(<DatePicker label="Beginn" value="" onChange={onChange} />);
		expect(
			(screen.getByLabelText('Beginn') as HTMLInputElement).value
		).toBe('');
	});

	it('refuses a typed date outside min and max and shows the kept date again', () => {
		const onChange = vi.fn();
		render(
			<DatePicker
				label="Ende"
				value="2026-03-05"
				onChange={onChange}
				min="2026-03-01"
				max="2026-03-31"
			/>
		);
		const input = screen.getByLabelText('Ende') as HTMLInputElement;

		fireEvent.change(input, { target: { value: '01.04.2026' } });
		fireEvent.blur(input);
		expect(onChange).not.toHaveBeenCalled();
		expect(input.value).toBe('05.03.2026');

		fireEvent.change(input, { target: { value: '28.02.2026' } });
		fireEvent.blur(input);
		expect(onChange).not.toHaveBeenCalled();
		expect(input.value).toBe('05.03.2026');

		fireEvent.change(input, { target: { value: '31.03.2026' } });
		fireEvent.blur(input);
		expect(onChange).toHaveBeenLastCalledWith('2026-03-31');
	});

	it('reports numbers as numbers and an empty field as null', () => {
		const onChange = vi.fn();
		render(
			<NumberField
				label="Tage"
				value={3}
				onChange={onChange}
				min={0}
				max={7}
			/>
		);

		const input = screen.getByLabelText('Tage') as HTMLInputElement;
		expect(input.value).toBe('3');
		expect(input.max).toBe('7');

		fireEvent.change(input, { target: { value: '5' } });
		expect(onChange).toHaveBeenLastCalledWith(5);

		fireEvent.change(input, { target: { value: '' } });
		expect(onChange).toHaveBeenLastCalledWith(null);
	});

	it('is part of the shared host modules', () => {
		const target: Record<string, unknown> = {};
		installAddonShared(target);

		expect((target[ADDON_SHARED_GLOBAL] as { kit: unknown }).kit).toBe(
			webKit
		);
	});
});
