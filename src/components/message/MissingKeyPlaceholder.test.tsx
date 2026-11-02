// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import de from '../../resources/i18n/de/common.json';
import { MissingKeyPlaceholder } from './MissingKeyPlaceholder';

// Real German catalogue, resolved the way i18next picks _one/_other.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) => {
			const node = key
				.split('.')
				.slice(0, -1)
				.reduce((acc: any, part) => acc?.[part], de) as Record<
				string,
				string
			>;
			const leaf = key.split('.').pop() as string;
			const suffix = options?.count === 1 ? '_one' : '_other';
			const template = node?.[`${leaf}${suffix}`] ?? node?.[leaf] ?? key;
			return template.replace('{{count}}', String(options?.count));
		}
	})
}));

afterEach(cleanup);

describe('MissingKeyPlaceholder (#1827)', () => {
	it('says plainly that an earlier message is not available on this device', () => {
		render(<MissingKeyPlaceholder count={1} />);
		const notice = screen.getByRole('status');
		expect(notice.textContent).toContain(
			'Frühere Nachricht auf diesem Gerät nicht verfügbar'
		);
		expect(notice.textContent).toContain(
			'Sie wird lesbar, sobald ein Gerät mit dem passenden Schlüssel online ist'
		);
	});

	it('collapses several messages into one counted notice', () => {
		render(<MissingKeyPlaceholder count={4} />);
		expect(screen.getAllByRole('status')).toHaveLength(1);
		expect(screen.getByRole('status').textContent).toContain(
			'4 frühere Nachrichten auf diesem Gerät nicht verfügbar'
		);
		expect(screen.getByRole('status').textContent).toContain(
			'Sie werden lesbar'
		);
	});

	it('uses no alarm wording', () => {
		render(<MissingKeyPlaceholder count={3} />);
		expect(screen.getByRole('status').textContent).not.toMatch(
			/verschlüsselt|Fehler|fehlgeschlagen/i
		);
	});

	it('shows the date divider of the first message when it has one', () => {
		render(<MissingKeyPlaceholder count={2} dateLabel="Heute" />);
		expect(screen.getByRole('separator').getAttribute('aria-label')).toBe(
			'Heute'
		);
	});
});
