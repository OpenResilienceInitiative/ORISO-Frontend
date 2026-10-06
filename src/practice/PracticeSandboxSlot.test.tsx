// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../globalState/context/UserDataContext';
import { endpoints } from '../resources/scripts/endpoints';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import { PRACTICE_ENQUIRY_SESSION_ID } from './fixtures/practiceIdentifiers';
import { usePracticeSandbox } from './PracticeSandbox';
import { PracticeSandboxSlot } from './PracticeSandboxSlot';
import { PracticeProvider } from './PracticeProvider';
import { enterPracticeMode, exitPracticeMode } from './practiceMode';
import type { PracticeWorld } from './practiceWorld';
import { createPracticeTestI18n } from './script/scriptTestSupport';

const ACCEPT = 'consultant-practice-accept';
const SUPERVISION = 'consultant-practice-supervision';
const counsellor = practiceCounsellorFixture();
let world: PracticeWorld | null = null;
const WorldProbe = () => {
	world = usePracticeSandbox().world;
	return null;
};

const settle = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const renderSlot = (tourId: string) => {
	enterPracticeMode({ tourId });
	return render(
		<I18nextProvider i18n={createPracticeTestI18n('de')}>
			<PracticeProvider>
				<UserDataContext.Provider
					value={{ userData: counsellor, setUserData: vi.fn() }}
				>
					<PracticeSandboxSlot>
						<WorldProbe />
					</PracticeSandboxSlot>
				</UserDataContext.Provider>
			</PracticeProvider>
		</I18nextProvider>
	);
};

beforeEach(() => {
	world = null;
	window.fetch = vi.fn(
		async () => new Response('real', { status: 200 })
	) as typeof window.fetch;
});

afterEach(async () => {
	cleanup();
	await settle();
	exitPracticeMode();
});

describe('PracticeSandboxSlot', () => {
	it('runs the routed content on the practice world of the logged-in counsellor', async () => {
		renderSlot(ACCEPT);

		const enquiries = await window.fetch(
			new Request(
				`${endpoints.consultantEnquiriesBase}registered?count=15&filter=all&offset=0`
			)
		);

		expect(world?.start).toBe('enquiry');
		expect((await enquiries.json()).sessions[0].session.id).toBe(
			PRACTICE_ENQUIRY_SESSION_ID
		);
	});

	it('starts the Supervision tour on the already accepted case', () => {
		renderSlot(SUPERVISION);

		expect(world?.start).toBe('acceptedCase');
		expect(world?.rest.getCase().session.status).toBe(2);
	});

	it('gives every new run fresh fixtures (a restart is end + enter on the same guard)', async () => {
		renderSlot(ACCEPT);
		await window.fetch(
			new Request(
				`${endpoints.sessionBase}/new/${PRACTICE_ENQUIRY_SESSION_ID}`,
				{ method: 'PUT' }
			)
		);
		const used = world;
		expect(used?.rest.getCase().session.status).toBe(2);

		act(() => enterPracticeMode({ tourId: ACCEPT }));

		expect(world).not.toBe(used);
		expect(world?.rest.getCase().session.status).toBe(1);
	});
});
