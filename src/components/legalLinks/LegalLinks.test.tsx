// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import LegalLinks from './LegalLinks';
import { TProvidedLegalLink } from '../../globalState/provider/LegalLinksProvider';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

const imprintLink = (
	getUrl: TProvidedLegalLink['getUrl']
): TProvidedLegalLink => ({
	label: 'login.legal.infoText.impressum',
	getUrl
});

const appendParams = (
	base: string,
	params?: { [key: string]: string | number | null | undefined }
) => {
	const url = new URL(base);
	Object.entries(params || {})
		.filter(([, value]) => !!value)
		.forEach(([key, value]) => url.searchParams.append(key, String(value)));
	return url.toString();
};

describe('LegalLinks', () => {
	afterEach(() => {
		cleanup();
	});

	it('builds platform URLs when params are omitted (profile footer, #1213)', () => {
		render(
			<LegalLinks
				legalLinks={[
					imprintLink((params) =>
						appendParams('https://example.test/impressum', params)
					)
				]}
			>
				{(label, url) => <a href={url}>{label}</a>}
			</LegalLinks>
		);

		const href = screen.getByRole('link').getAttribute('href');
		expect(href).toBe('https://example.test/impressum');
		expect(href).not.toContain('aid=');
	});

	it('still appends aid when a caller passes it (session menus)', () => {
		render(
			<LegalLinks
				legalLinks={[
					imprintLink((params) =>
						appendParams('https://example.test/impressum', params)
					)
				]}
				params={{ aid: 7 }}
			>
				{(label, url) => <a href={url}>{label}</a>}
			</LegalLinks>
		);

		expect(screen.getByRole('link').getAttribute('href')).toContain(
			'aid=7'
		);
	});
});
