// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalContentRenderer } from './LegalContentRenderer';

let mockLanguage = 'de';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: {
			get language() {
				return mockLanguage;
			}
		}
	})
}));

vi.mock('./legalContent.styles.scss', () => ({}));

const map = (entries: Record<string, unknown>) => JSON.stringify(entries);

describe('LegalContentRenderer', () => {
	afterEach(() => {
		cleanup();
		mockLanguage = 'de';
	});

	it('renders plain HTML without any notice', () => {
		render(<LegalContentRenderer content="<p>Datenschutz pur</p>" />);

		expect(screen.getByText('Datenschutz pur')).toBeDefined();
		expect(screen.queryByRole('note')).toBeNull();
	});

	it('renders nothing for empty content', () => {
		const { container } = render(<LegalContentRenderer content="" />);
		expect(container.innerHTML).toBe('');
	});

	it('shows the fallback notice when the UI language is missing', () => {
		mockLanguage = 'fr';
		render(<LegalContentRenderer content={map({ de: '<p>Hallo</p>' })} />);

		expect(screen.getByText('Hallo')).toBeDefined();
		expect(
			screen.getByText(
				'Dieser Text liegt nicht in Ihrer Sprache vor und wird in seiner Originalsprache angezeigt.'
			)
		).toBeDefined();
	});

	it('shows the machine translation notice and toggles to the original', () => {
		mockLanguage = 'en';
		render(
			<LegalContentRenderer
				content={map({
					de: '<p>Hallo Original</p>',
					en: '<p>Hello translated</p>',
					en__meta: JSON.stringify({ mt: true, src: 'de' })
				})}
			/>
		);

		expect(screen.getByText('Hello translated')).toBeDefined();
		expect(
			screen.getByText(
				'Maschinell übersetzt — rechtlich verbindlich ist die deutsche Fassung.'
			)
		).toBeDefined();

		fireEvent.click(screen.getByText('Original anzeigen'));

		expect(screen.getByText('Hallo Original')).toBeDefined();
		expect(screen.queryByText('Hello translated')).toBeNull();

		fireEvent.click(screen.getByText('Übersetzung anzeigen'));
		expect(screen.getByText('Hello translated')).toBeDefined();
	});

	it('never renders __meta values as content', () => {
		mockLanguage = 'en';
		const { container } = render(
			<LegalContentRenderer
				content={map({
					de: '<p>Hallo</p>',
					en__meta: JSON.stringify({ mt: true, src: 'de' })
				})}
			/>
		);

		expect(container.textContent).not.toContain('mt');
		expect(container.textContent).not.toContain('src');
		expect(screen.getByText('Hallo')).toBeDefined();
	});
});
