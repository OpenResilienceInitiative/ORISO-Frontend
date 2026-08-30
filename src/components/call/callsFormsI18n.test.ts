import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Call widgets, form/modal primitives, and the post-#1242 rescan extras
 * used raw English/German JSX, default props, alerts, and prompts.
 * Missing keys must follow fallbackLng — not a hardcoded language (#1154).
 */
const SLICE_FILES = [
	'src/components/call/FloatingCallWidget.tsx',
	'src/components/call/GroupCallWidget.tsx',
	'src/components/matrixCall/MatrixCallView.tsx',
	'src/components/videoCall/VideoCall.tsx',
	'src/services/CallManager.ts',
	'src/components/sessionMenu/SessionMenu.tsx',
	'src/components/sessionHeader/GroupChatHeader/index.tsx',
	'src/components/modal/OrisoDialog.tsx',
	'src/components/form/OrisoCalendar.tsx',
	'src/components/form/OrisoDatePicker.tsx',
	'src/components/form/OrisoTimePicker.tsx',
	'src/components/form/OrisoSelect.tsx',
	'src/components/messageSubmitInterface/TipTapComposer.tsx',
	'src/components/messageSubmitInterface/inputField/EmojiPickerPopup.tsx',
	'src/components/session/ThreadListPanel.tsx',
	'src/components/departmentLegal/DepartmentLegalSection.tsx',
	'src/containers/bookings/components/AssignedCalendars/assignedCalendars.tsx',
	'src/containers/bookings/components/AvailabilityContainer/availabilityContainer.tsx',
	'src/components/uiVersionToggle/UIVersionToggle.tsx',
	'src/components/notFound/NotFound.tsx',
	'src/containers/bookings/components/Calcom/Cal.tsx',
	'src/components/message/MessageItemComponent.tsx',
	'src/components/header/Header.tsx',
	'src/components/pseudonym/BotMessageAnimation.tsx',
	'src/containers/bookings/components/BookingReschedule/bookingReschedule.tsx',
	'src/containers/bookings/components/BookingCancellation/bookingCancellation.tsx',
	'src/components/draftsCenter/DraftsCenter.tsx'
];

const ONE_LANGUAGE_CHROME = [
	/['"]Fullscreen['"]/,
	/['"]Answer['"]/,
	/['"]Reject['"]/,
	/['"]End call['"]/,
	/['"]Video Call['"]/,
	/['"]Audio Call['"]/,
	/['"]Auto-fit video['"]/,
	/>Incoming Call</,
	/Someone is calling/,
	/['"]Decline['"]/,
	/['"]Close call['"]/,
	/>Setting up call</,
	/>Connecting\.\.\.</,
	/['"]Group video call['"]/,
	/['"]Open full view['"]/,
	/['"]More options['"]/,
	/No room ID provided/,
	/Cannot start call without a room ID/,
	/>Go Back</,
	/Failed to start call:/,
	/Failed to answer:/,
	/Cannot start call: No Matrix room/,
	/Camera\/microphone access requires HTTPS/,
	/Cannot access camera\/microphone/,
	/backLabel = 'Zurück'/,
	/confirmLabel = 'Verstanden'/,
	/aria-label="Schliessen"/,
	/cancelLabel = 'Cancel'/,
	/okLabel = 'OK'/,
	/dialogTitle = 'Select time'/,
	/['"]Previous month['"]/,
	/['"]Select month['"]/,
	/['"]Next month['"]/,
	/['"]Previous year['"]/,
	/['"]Select year['"]/,
	/['"]Next year['"]/,
	/['"]Open calendar['"]/,
	/['"]Open time picker['"]/,
	/['"]Select hours['"]/,
	/['"]Select minutes['"]/,
	/['"]Switch to text input['"]/,
	/['"]Switch to dial['"]/,
	/searchPlaceholder = 'Search'/,
	/searchPlaceHolder="Suchen"/,
	/unknownRootLabel = 'Frühere Nachricht'/,
	/`\$\{count\} replies`/,
	/aria-label="Undo"/,
	/aria-label="Redo"/,
	/aria-label="Bold"/,
	/aria-label="Bullet List"/,
	/aria-label="Ordered List"/,
	/aria-label="Quick Link"/,
	/window\.prompt\('Image URL'/,
	/window\.prompt\('URL'/,
	/aria-label="loading"/,
	/title=\{'AssignedCalendars'\}/,
	/title=\{'AvailabilityContainer'\}/,
	/REACT_APP_ELEMENT_URL is not set/,
	/<span>Call<\/span>/,
	/ NOT FOUND/,
	/>Loading \{calLink\}/,
	/alt="Message image"/,
	/alt="Logo"/,
	/aria-label="typing"/,
	/title="booking-reschedule"/,
	/title="booking-cancellation"/,
	/title="drafts-chat-session"/
];

const REQUIRED_CALL_KEYS = [
	'answer',
	'reject',
	'endCall',
	'fullscreen',
	'title',
	'videoCall',
	'audioCall'
] as const;

const REQUIRED_FORM_DIALOG_KEYS = ['back', 'confirm', 'close'] as const;

const stripComments = (src: string): string =>
	src
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
		.replace(/^\s*\/\/.*$/gm, '');

describe('call and form chrome has no leftover DE/EN literals (#1154)', () => {
	it.each(SLICE_FILES)('%s', (relativePath) => {
		const src = stripComments(
			readFileSync(resolve(process.cwd(), relativePath), 'utf8')
		);
		const hits = ONE_LANGUAGE_CHROME.filter((pattern) => pattern.test(src));
		expect(hits.map(String)).toEqual([]);
	});

	it('ships calls and form.dialog keys in every UI locale', () => {
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
				calls?: Record<string, unknown> & {
					widget?: { startFailed?: string };
					group?: { incomingTitle?: string };
					error?: { noRoom?: string };
				};
				form?: { dialog?: Record<string, string> };
			};
			for (const key of REQUIRED_CALL_KEYS) {
				expect(
					catalogue.calls?.[key],
					`${locale} calls.${key}`
				).toBeTruthy();
			}
			expect(
				catalogue.calls?.widget?.startFailed,
				`${locale} calls.widget.startFailed`
			).toMatch(/\{\{\s*message\s*\}\}/);
			expect(
				catalogue.calls?.group?.incomingTitle,
				`${locale} calls.group.incomingTitle`
			).toBeTruthy();
			expect(
				catalogue.calls?.error?.noRoom,
				`${locale} calls.error.noRoom`
			).toBeTruthy();
			for (const key of REQUIRED_FORM_DIALOG_KEYS) {
				expect(
					catalogue.form?.dialog?.[key],
					`${locale} form.dialog.${key}`
				).toBeTruthy();
			}
		}
	});
});
