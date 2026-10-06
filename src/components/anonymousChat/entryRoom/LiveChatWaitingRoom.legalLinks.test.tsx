// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../../globalState/provider/LegalLinksProvider';
import { LiveChatWaitingRoom } from './LiveChatWaitingRoom';

afterEach(() => cleanup());
/* jsdom has no canvas for the lottie player. */
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));

/* The dialog itself is covered by LegalLinkModal's own tests; here only which
   document it is asked to open matters. */
const opened = vi.hoisted(() => ({ props: null as any }));
vi.mock('../../legalLinks/LegalLinkModal', () => ({
	LegalLinkModal: (props: any) => {
		opened.props = props;
		return <div role="dialog">{props.title}</div>;
	}
}));

const PRIVACY_URL = 'https://oriso.example/datenschutz';
const legalLinks = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => PRIVACY_URL
	} as TProvidedLegalLink
];
const CONSENT_HTML = `Ich habe die <a href="${PRIVACY_URL}">Datenschutzerklärung</a> zur Kenntnis genommen.`;

const renderAccepted = (
	department?: { agencyId: number; topicId: number } | null
) =>
	render(
		<LegalLinksContext.Provider value={legalLinks}>
			<LiveChatWaitingRoom
				ahead={0}
				accepted
				consentHtml={CONSENT_HTML}
				department={department}
				onAccept={() => undefined}
				onLeave={() => undefined}
				onMailCounselling={() => undefined}
			/>
		</LegalLinksContext.Provider>
	);

beforeEach(() => {
	opened.props = null;
});

describe('LiveChatWaitingRoom — the legal links in the consent sentence', () => {
	/* A plain anchor left the room for /datenschutz, a page, instead of the
	   dialog registration opens — and never the counselling centre's text. */
	it("opens the accepting centre's document in the dialog, not a page", () => {
		renderAccepted({ agencyId: 7, topicId: 20 });

		expect(
			screen.queryByRole('link', { name: 'Datenschutzerklärung' })
		).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'Datenschutzerklärung' })
		);

		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(opened.props).toMatchObject({
			scope: 'agency',
			agencyId: 7,
			topicId: 20,
			rawLabel: 'login.legal.infoText.dataprotection'
		});
	});

	it('opens the platform document while no centre is known', () => {
		renderAccepted(null);

		fireEvent.click(
			screen.getByRole('button', { name: 'Datenschutzerklärung' })
		);

		expect(opened.props).toMatchObject({ scope: 'platform' });
	});

	it('does not tick the box when the reader opens what they consent to', () => {
		renderAccepted({ agencyId: 7, topicId: 20 });

		fireEvent.click(
			screen.getByRole('button', { name: 'Datenschutzerklärung' })
		);

		expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
			false
		);
	});
});
