// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../globalState/provider/LegalLinksProvider';
import { useLegalHtmlWithDialogs } from './useLegalHtmlWithDialogs';

afterEach(() => cleanup());
vi.mock('./LegalLinkModal', () => ({ LegalLinkModal: () => null }));

const PRIVACY_URL = 'https://oriso.example/datenschutz';
/* Like LegalLinksProvider: a set `aid` is appended as a query parameter. */
const legalLinks = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: (params?: { aid?: number | null }) =>
			params?.aid ? `${PRIVACY_URL}?aid=${params.aid}` : PRIVACY_URL
	} as TProvidedLegalLink
];

const Sentence = ({ html }: { html: string }) => {
	const render = useLegalHtmlWithDialogs({
		scope: 'agency',
		agencyId: 19,
		topicId: 17
	});
	return <p>{render(html)}</p>;
};

const renderSentence = (href: string) =>
	render(
		<LegalLinksContext.Provider value={legalLinks}>
			<Sentence
				html={`Ich habe die <a href="${href}">Datenschutzerklärung</a> gelesen.`}
			/>
		</LegalLinksContext.Provider>
	);

describe('useLegalHtmlWithDialogs', () => {
	/* useConsentSentences renders the links with the group's `aid`. */
	it('opens a link carrying the agency id in the dialog', () => {
		renderSentence(`${PRIVACY_URL}?aid=19`);

		expect(
			screen.getByRole('button', { name: 'Datenschutzerklärung' })
		).toBeTruthy();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it("leaves a Träger's own link an anchor", () => {
		renderSentence('https://traeger.example/datenschutz');

		expect(
			screen.getByRole('link', { name: 'Datenschutzerklärung' })
		).toBeTruthy();
	});
});
