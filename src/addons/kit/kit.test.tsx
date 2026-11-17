// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { webKit } from '.';
import { ADDON_SHARED_GLOBAL, installAddonShared } from '../addonShared';

const { Button, Headline, TextField, Checkbox } = webKit;

describe('web kit', () => {
	it('renders button text as given, without treating it as a translation key', () => {
		const onClick = vi.fn();
		render(<Button onClick={onClick}>Teil 2: Weiter</Button>);

		fireEvent.click(screen.getByRole('button', { name: 'Teil 2: Weiter' }));

		expect(onClick).toHaveBeenCalledTimes(1);
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

	it('is part of the shared host modules', () => {
		const target: Record<string, unknown> = {};
		installAddonShared(target);

		expect((target[ADDON_SHARED_GLOBAL] as { kit: unknown }).kit).toBe(
			webKit
		);
	});
});
