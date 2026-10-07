// @vitest-environment jsdom
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext, NotificationsContext } from '../../../globalState';
import { NotificationSwitchRow } from './NotificationSwitchRow';
import { ADVICE_SEEKER_SWITCHES } from './notificationMatrix';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../../api/apiPatchUserData', () => ({ apiPatchUserData: vi.fn() }));
afterEach(cleanup);
const titles = {
	'de': 'Anfragen zu Einsicht und Übergabe',
	'de@informal': 'Anfragen zu Einsicht und Übergabe',
	'en': 'Access and handover requests',
	'fr': 'Demandes d’accès et de transfert',
	'ru': 'Запросы доступа и передачи',
	'tr': 'Erişim ve devir talepleri',
	'ti': 'ሕቶታት መእተዊን ምስግጋርን'
};

describe('consent notification preference locales', () => {
	it.each(Object.entries(titles))(
		'renders the existing settings control in %s',
		async (locale, title) => {
			const catalogue = JSON.parse(
				readFileSync(`src/resources/i18n/${locale}/common.json`, 'utf8')
			);
			const i18n = createInstance();
			await i18n.use(initReactI18next).init({
				lng: locale,
				fallbackLng: locale === 'de@informal' ? 'de' : false,
				resources: {
					de: {
						translation: JSON.parse(
							readFileSync(
								'src/resources/i18n/de/common.json',
								'utf8'
							)
						)
					},
					[locale]: { translation: catalogue }
				}
			});
			const entry = ADVICE_SEEKER_SWITCHES.find(
				(row) => row.id === 'reassignment'
			);
			expect(entry).toBeDefined();
			render(
				<I18nextProvider i18n={i18n}>
					<NotificationsContext.Provider
						value={{ addNotification: vi.fn() } as never}
					>
						<UserDataContext.Provider
							value={
								{
									userData: {
										emailNotifications: {
											emailNotificationsEnabled: true,
											settings: {
												reassignmentNotificationEnabled: true
											}
										}
									},
									reloadUserData: vi.fn()
								} as never
							}
						>
							<NotificationSwitchRow entry={entry!} />
						</UserDataContext.Provider>
					</NotificationsContext.Provider>
				</I18nextProvider>
			);
			expect(
				screen.getByRole<HTMLInputElement>('switch', { name: title })
					.checked
			).toBe(true);
			expect(
				screen.getByText(
					catalogue.profile.notifications.matrix.asker.consentRequest
						.description
				)
			).toBeTruthy();
		}
	);
});
