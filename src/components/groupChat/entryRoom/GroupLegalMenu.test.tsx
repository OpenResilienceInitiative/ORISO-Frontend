// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../../globalState/provider/LegalLinksProvider';
import { GroupLegalMenu } from './GroupLegalMenu';

afterEach(() => cleanup());

const opened = vi.hoisted(() => ({ props: null as any }));
vi.mock('../../legalLinks/LegalLinkModal', () => ({
	LegalLinkModal: (props: any) => {
		opened.props = props;
		return <div role="dialog">{props.title}</div>;
	}
}));

const legalLinks = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink
];

const openPrivacy = (
	department: { agencyId: number; topicId: number } | null
) => {
	render(
		<LegalLinksContext.Provider value={legalLinks}>
			<GroupLegalMenu department={department} />
		</LegalLinksContext.Provider>
	);
	fireEvent.click(screen.getByRole('button', { name: 'Rechtliches' }));
	fireEvent.click(screen.getAllByRole('menuitem')[0]);
};

beforeEach(() => {
	opened.props = null;
});

describe('GroupLegalMenu', () => {
	/* Frank, 2026-10-28: before anyone signs up, the platform's documents
	   apply — never the Träger's. */
	it('opens the platform document while no centre is known', () => {
		openPrivacy(null);

		expect(opened.props).toMatchObject({ scope: 'platform' });
	});

	it("opens the centre's document once the person registered for it", () => {
		openPrivacy({ agencyId: 7, topicId: 20 });

		expect(opened.props).toMatchObject({
			scope: 'agency',
			agencyId: 7,
			topicId: 20
		});
	});
});
