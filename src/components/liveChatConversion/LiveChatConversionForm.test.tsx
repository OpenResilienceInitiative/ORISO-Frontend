// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveChatConversionForm } from './LiveChatConversionForm';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (_key: string, fallback: string) => fallback })
}));

describe('Live Chat account conversion form', () => {
	it('requires matching long passwords', () => {
		const submit = vi.fn();
		render(
			<LiveChatConversionForm
				loginName="guest-name"
				onSubmit={submit}
				busy={false}
			/>
		);
		const button = screen.getByRole('button', {
			name: 'Create my account'
		});
		expect((button as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(screen.getByLabelText('Password'), {
			target: { value: 'synthetic-password-123' }
		});
		fireEvent.change(screen.getByLabelText('Repeat password'), {
			target: { value: 'synthetic-password-123' }
		});
		expect((button as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(button);
		expect(submit).toHaveBeenCalledWith('synthetic-password-123');
	});
});
