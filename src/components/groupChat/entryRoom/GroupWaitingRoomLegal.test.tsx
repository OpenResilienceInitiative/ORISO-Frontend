// @vitest-environment jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';

vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../stage/stage', () => ({ Stage: () => null }));
/* The phone bar is where the stage puts `renderHeaderAction('onPrimary')`. */
vi.mock('../../stageLayout/StageLayout', () => ({
	StageLayout: ({
		children,
		renderHeaderAction
	}: {
		children: React.ReactNode;
		renderHeaderAction?: (tone: string) => React.ReactNode;
	}) => (
		<main>
			<header data-testid="phone-bar">
				{renderHeaderAction?.('onPrimary')}
			</header>
			{children}
		</main>
	)
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) =>
			typeof fallback === 'string' ? fallback : _key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));
vi.mock('../../../api/apiGetAgencyId', () => ({
	apiGetAgencyById: vi.fn(() => Promise.resolve({ id: 19, topicIds: [17] }))
}));
vi.mock('../../legalLinks/LegalLinkModal', () => ({
	LegalLinkModal: (props: {
		title: string;
		scope?: string;
		agencyId?: number;
		topicId?: number;
	}) => (
		<div
			data-testid="legal-modal"
			data-title={props.title}
			data-scope={props.scope}
			data-agency={String(props.agencyId)}
			data-topic={String(props.topicId)}
		/>
	)
}));

const { GroupWaitingRoom } = await import('./GroupWaitingRoom');

const legalLinks = [
	{
		label: 'Datenschutzerklärung',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	},
	{
		label: 'Impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	}
] as any;

const NOW = Date.UTC(2026, 8, 4, 14, 0, 0);

const renderRoom = () =>
	render(
		<LegalLinksContext.Provider value={legalLinks}>
			<GroupWaitingRoom
				topicName="Trauerbegleitung"
				agencyName="Beratungstelle"
				agencyId={19}
				plannedStart={new Date(NOW + 3 * 24 * 3600e3)}
				eventId={20}
				rules={[]}
				active={false}
				onJoin={() => undefined}
				nowMs={NOW}
			/>
		</LegalLinksContext.Provider>
	);

/**
 * # Datenschutz and Impressum in the client's group waiting room (#1499)
 *
 * On a phone the stage prints no legal links. The room gets the same way to
 * them as every chat room: a menu, which opens the documents of the
 * Beratungsstelle that runs the group.
 */
describe('GroupWaitingRoom — legal menu', () => {
	afterEach(cleanup);

	it('offers Datenschutz and Impressum from a menu in the phone bar', () => {
		renderRoom();

		fireEvent.click(screen.getByRole('button', { name: 'Rechtliches' }));

		expect(
			screen.getByRole('menuitem', { name: 'Datenschutzerklärung' })
		).toBeTruthy();
		expect(
			screen.getByRole('menuitem', { name: 'Impressum' })
		).toBeTruthy();
	});

	it("opens the group's Beratungsstelle documents", async () => {
		renderRoom();
		// The agency's topic arrives with the agency lookup.
		await act(async () => undefined);

		fireEvent.click(screen.getByRole('button', { name: 'Rechtliches' }));
		fireEvent.click(
			screen.getByRole('menuitem', { name: 'Datenschutzerklärung' })
		);

		const modal = screen.getByTestId('legal-modal');
		expect(modal.dataset.title).toBe('Datenschutzerklärung');
		expect(modal.dataset.scope).toBe('agency');
		expect(modal.dataset.agency).toBe('19');
		expect(modal.dataset.topic).toBe('17');
	});
});
