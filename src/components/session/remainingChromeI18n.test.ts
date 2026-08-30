import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Post-leftovers rescan: session chrome, waiting countdown, notifications,
 * legal, handover, and opening hours still passed German or English i18next
 * fallbacks. Missing keys then snapped to one language (#1154).
 */
const SLICE_FILES = [
	'src/components/sessionHeader/SessionHeaderComponent.tsx',
	'src/components/sessionMenu/SessionMenu.tsx',
	'src/components/sessionsListItem/SessionListItemComponent.tsx',
	'src/components/sessionsList/ResizableHandle.tsx',
	'src/components/sessionsList/SessionsList.tsx',
	'src/components/groupChat/waitingClock/WaitingAreaCountdown.tsx',
	'src/components/groupChat/JoinGroupChatView.tsx',
	'src/components/notificationsCenter/NotificationsCenter.tsx',
	'src/components/notificationsCenter/ConversationPreview.tsx',
	'src/components/pseudonym/PseudonymCard.tsx',
	'src/components/pseudonym/PrivacyMessageCard.tsx',
	'src/components/legalLinks/LegalLinkModal.tsx',
	'src/components/legalPageWrapper/LegalPageWrapper.tsx',
	'src/components/profile/NotificationSettings/index.tsx',
	'src/components/erstantwort/ErstantwortSequence.tsx',
	'src/components/message/MessageDisplayName.tsx',
	'src/components/registration/Registration.tsx',
	'src/components/registration/agencySelection/AgencyDetailsPanel.tsx',
	'src/components/registration/preselectionBox/PreselectedConsultant.tsx',
	'src/components/registration/preselectionDrawer/preselectionDrawer.tsx',
	'src/components/app/registrationLoader/HandoverCarousel.tsx',
	'src/utils/openingHours.ts'
];

const ONE_LANGUAGE_FALLBACKS = [
	/'Supervisor verwalten'/,
	/'Chatraum Einstellungen'/,
	/'Interna'/,
	/'Gesprächskreis'/,
	/'Live Chat'/,
	/'Team Beratung'/,
	/'Begrüßung deiner Beratung'/,
	/'Animation abschalten'/,
	/'Wir sind gleich für dich da\.'/,
	/'Chat rules'/,
	/'Load older activity'/,
	/'Open chat'/,
	/'Show conversation preview'/,
	/'Your privacy'/,
	/'Dein Pseudonym'/,
	/'Benachrichtigungen'/,
	/'Ihre ersten Schritte'/,
	/'System Notification'/,
	/'Registering\.\.\.'/,
	/'Adresse'/,
	/'Rechtliches'/,
	/'This counselor is currently absent/,
	/titleFallback:\s*'Sie schreiben/,
	/WEEKDAY_FALLBACK/,
	/defaultValue:\s*'Waiting since/,
	/defaultValue:\s*'Zu Schritt/,
	/translateWithFallback/
];

describe('remaining chrome has no one-language t() fallbacks (#1154)', () => {
	it.each(SLICE_FILES)('%s', (relativePath) => {
		const src = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
		const hits = ONE_LANGUAGE_FALLBACKS.filter((pattern) =>
			pattern.test(src)
		);
		expect(hits.map(String)).toEqual([]);
	});

	it('ships resizeHandle and team session-type keys in every UI locale', () => {
		const locales = ['de', 'en', 'fr', 'ru', 'ti', 'tr'];
		for (const locale of locales) {
			const catalogue = JSON.parse(
				readFileSync(
					resolve(
						process.cwd(),
						`src/resources/i18n/${locale}/common.json`
					),
					'utf8'
				)
			) as {
				sessionList?: {
					item?: { sessionType?: { team?: string } };
					resizeHandle?: {
						ariaLabel?: string;
						expand?: string;
						collapse?: string;
					};
				};
			};
			expect(
				catalogue.sessionList?.item?.sessionType?.team,
				`${locale} sessionType.team`
			).toBeTruthy();
			expect(
				catalogue.sessionList?.resizeHandle?.ariaLabel,
				`${locale} resizeHandle.ariaLabel`
			).toBeTruthy();
			expect(
				catalogue.sessionList?.resizeHandle?.expand,
				`${locale} resizeHandle.expand`
			).toBeTruthy();
			expect(
				catalogue.sessionList?.resizeHandle?.collapse,
				`${locale} resizeHandle.collapse`
			).toBeTruthy();
		}
	});
});
