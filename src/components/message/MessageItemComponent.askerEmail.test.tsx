// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ActiveSessionContext,
	E2EEContext,
	ServerSettingsContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import type { TenantDataInterface } from '../../globalState/interfaces';
import { MessageItemComponent } from './MessageItemComponent';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockE2EEContext,
	mockE2eeParams,
	mockMessageItemComponentProps,
	mockServerSettingsContext,
	mockUserData
} from './MessageItemComponent.mocks';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

/* Pulled in transitively through the Erstantwort illustration; lottie-web
   touches a canvas 2D context at import time and jsdom has none. Same stub as
   SessionListItemComponent.test.tsx. */
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

/**
 * The wiring test the Träger switch never had (VERDRAHTUNG §5.2 no. 1, inventory
 * finding L5). `isBausteinSilenced` and its unit test have existed since ADR-018
 * landed; what was missing is the single line that carries the tenant setting
 * from the provider into `ErstantwortMessage`, so the silencing never fired in
 * the product. This test renders the real call site rather than the resolver, so
 * a future refactor that drops the prop again goes red here.
 */

const EMAIL_BAUSTEIN_BODY =
	'Sie können freiwillig eine E-Mail-Adresse hinterlegen. Der Inhalt der Beratung steht nie in dieser E-Mail.';
const GREETING_BAUSTEIN_BODY = 'Schön, dass Sie sich gemeldet haben.';

const erstantwortEvent = `[SYSTEM_NOTIFICATION]${JSON.stringify({
	type: 'FIRST_RESPONSE',
	version: 1,
	bausteine: [
		{ id: 'greeting', body: GREETING_BAUSTEIN_BODY },
		{
			id: 'emailNotification',
			body: EMAIL_BAUSTEIN_BODY,
			action: { kind: 'ADD_EMAIL', label: 'E-Mail-Adresse angeben' }
		}
	]
})}`;

const tenantWith = (featureAskerEmailEnabled?: boolean): TenantDataInterface =>
	({
		id: 1,
		name: 'Testträger',
		settings: {
			/* Only the key under test is set; the switch must be read as an
			   independent flag, not inferred from its neighbours. */
			...(featureAskerEmailEnabled === undefined
				? {}
				: { featureAskerEmailEnabled })
		}
	}) as unknown as TenantDataInterface;

const renderErstantwortMessage = (tenant: TenantDataInterface) =>
	render(
		<MemoryRouter>
			<TenantContext.Provider value={{ tenant, setTenant: () => {} }}>
				<ServerSettingsContext.Provider
					value={mockServerSettingsContext() as any}
				>
					<E2EEContext.Provider value={mockE2EEContext() as any}>
						<UserDataContext.Provider
							value={
								{
									userData: mockUserData({
										userId: MOCK_ASKER_MATRIX_ID,
										email: undefined
									} as any),
									setUserData: () => {},
									reloadUserData: async () => null as any
								} as any
							}
						>
							<ActiveSessionContext.Provider
								value={
									{
										activeSession: mockActiveSession1on1(),
										reloadActiveSession: () => {},
										readActiveSession: () => {}
									} as any
								}
							>
								<MessageItemComponent
									{...mockMessageItemComponentProps({
										message: erstantwortEvent,
										/* Old enough that the stagger is skipped —
										   the whole sequence must be in the DOM
										   synchronously for a truthful assertion. */
										messageTime: '1',
										t: null
									})}
									handleDecryptionErrors={() => {}}
									handleDecryptionSuccess={() => {}}
									e2eeParams={mockE2eeParams() as any}
								/>
							</ActiveSessionContext.Provider>
						</UserDataContext.Provider>
					</E2EEContext.Provider>
				</ServerSettingsContext.Provider>
			</TenantContext.Provider>
		</MemoryRouter>
	);

afterEach(cleanup);

describe('MessageItemComponent — Träger switch for the asker e-mail', () => {
	it('drops the e-mail Baustein when the Träger switched the invitation off', () => {
		renderErstantwortMessage(tenantWith(false));

		expect(screen.queryByText(EMAIL_BAUSTEIN_BODY)).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'E-Mail-Adresse angeben' })
		).toBeNull();
		// The rest of the sequence is untouched — the switch silences one
		// Baustein, it does not suppress the Erstantwort.
		expect(screen.getByText(GREETING_BAUSTEIN_BODY)).toBeTruthy();
	});

	it('keeps the e-mail Baustein when the Träger switched the invitation on', () => {
		renderErstantwortMessage(tenantWith(true));

		expect(screen.getByText(EMAIL_BAUSTEIN_BODY)).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'E-Mail-Adresse angeben' })
		).toBeTruthy();
	});

	/* The setting is opt-out (TenantSettings.BOOLEAN_FIELD_DEFAULTS): a tenant
	   that has never opened the card sends no key at all, and `undefined` must
	   keep today's behaviour. Reading it as "off" would silently take the
	   Baustein away from every existing Träger. */
	it('keeps the e-mail Baustein when the Träger never configured the switch', () => {
		renderErstantwortMessage(tenantWith(undefined));

		expect(screen.getByText(EMAIL_BAUSTEIN_BODY)).toBeTruthy();
	});

	it('keeps the e-mail Baustein when no tenant is loaded at all', () => {
		renderErstantwortMessage(undefined as unknown as TenantDataInterface);

		expect(screen.getByText(EMAIL_BAUSTEIN_BODY)).toBeTruthy();
	});
});
