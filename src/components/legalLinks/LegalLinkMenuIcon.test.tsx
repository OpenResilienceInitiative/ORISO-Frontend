// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalLinkMenuIcon } from './LegalLinkMenuIcon';

vi.mock('../../resources/img/icons', () => ({
	GdprIcon: (props: React.SVGProps<SVGSVGElement>) => (
		<svg data-testid="gdpr-icon" {...props} />
	)
}));

afterEach(() => {
	cleanup();
});

const renderPrivacyIcon = (title: string, url: string) =>
	render(
		<LegalLinkMenuIcon
			title={title}
			url={url}
			rawLabel="login.legal.infoText.dataprotection"
		/>
	);

const assertGdprNotFingerprint = (container: HTMLElement) => {
	const icon = container.querySelector(
		'[data-testid="gdpr-icon"]'
	) as SVGSVGElement | null;
	expect(icon).toBeTruthy();
	expect(icon?.getAttribute('data-icon')).toBe('gdpr');
	expect(icon?.getAttribute('data-legal-kind')).toBe('privacy');
	expect(container.querySelector('[data-icon="fingerprint"]')).toBeNull();
	expect(
		container.querySelector('[data-testid="documents-copy-icon"]')
	).toBeNull();
};

describe('LegalLinkMenuIcon', () => {
	it('English "Privacy policy" gets the GDPR icon, not a fingerprint', () => {
		const { container } = renderPrivacyIcon(
			'Privacy policy',
			'https://example.test/privacy'
		);
		assertGdprNotFingerprint(container);
	});

	it('German "Datenschutz" gets the GDPR icon', () => {
		const { container } = renderPrivacyIcon(
			'Datenschutz',
			'https://example.test/datenschutz'
		);
		assertGdprNotFingerprint(container);
	});

	it('French privacy title gets the GDPR icon', () => {
		const { container } = renderPrivacyIcon(
			'Politique de confidentialité',
			'https://example.test/legal/fr'
		);
		assertGdprNotFingerprint(container);
	});
});
