// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveChatConversionExpired } from './LiveChatConversionExpired';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (_key: string, fallback: string) => fallback })
}));

describe('expired Live Chat conversion', () => {
	it('explains that a new registration would start a separate conversation', () => {
		render(<LiveChatConversionExpired />);
		expect(
			screen.getByRole('heading', {
				name: 'This Live Chat session has expired'
			})
		).toBeTruthy();
		expect(
			screen.getByText(
				/A new registration starts a separate conversation/
			)
		).toBeTruthy();
		expect(
			screen
				.getByRole('link', { name: 'Start a new registration' })
				.getAttribute('href')
		).toBe('/registration');
	});
});
