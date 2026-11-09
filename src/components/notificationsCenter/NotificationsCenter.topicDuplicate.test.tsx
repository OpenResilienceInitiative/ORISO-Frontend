// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { Context as ResponsiveContext } from 'react-responsive';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiGetSessionRoomsByRoomIds } from '../../api/apiGetSessionRooms';
import { apiFetchUserDrafts } from '../../api/apiUserDrafts';
import { NotificationsContext, UserDataContext } from '../../globalState';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import de from '../../resources/i18n/de/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';
import { describeActivityEvent } from './activityEvent';
import { parseEventActionParams } from './notificationActionTarget';
import { NotificationsCenter } from './NotificationsCenter';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: vi.fn()
}));
vi.mock('../../api/apiUserDrafts', () => ({ apiFetchUserDrafts: vi.fn() }));

const caseId = 42;
const room = '!existing:example.invalid';
const consultantId = 'existing-counsellor';
const consultantPath = `/sessions/consultant/sessionView/${room}/${caseId}`;
const item: NotificationFeedItem = {
	id: 'duplicate-1',
	type: 'info',
	eventType: 'topic_duplicate.started',
	category: 'system',
	title: 'Another counselling on the same topic',
	text: 'Another counselling on the topic of chat #42 has started.',
	createdAt: '2026-10-08T00:00:00Z',
	readAt: null,
	sourceSessionId: caseId,
	actionPath: `/sessions/user/view/${room}/${caseId}`,
	params: parseEventActionParams({
		conversationType: 'AGENCY_COUNSELLING',
		sessionId: caseId,
		roomRef: room,
		topicId: 14
	})
};
const catalogues = { de, 'de@informal': deInformal, en, fr, ru, ti, tr };
const locale = async (lng: string) => {
	const i18n = createInstance();
	await i18n.init({
		lng,
		fallbackLng: { 'de@informal': ['de'], 'default': ['de'] },
		returnEmptyString: true,
		resources: Object.fromEntries(
			Object.entries(catalogues).map(([key, translation]) => [
				key,
				{ translation }
			])
		)
	});
	return i18n;
};

const Location = () => (
	<output aria-label="Current route">
		{useLocation().pathname + useLocation().search}
	</output>
);
const currentRoute = () => screen.getByLabelText('Current route').textContent;
const openChat = () =>
	screen.getAllByRole('button', { name: 'Chat öffnen', exact: true })[0];

const renderCenter = async (event = item, width = 1440) => {
	const i18n = await locale('de');
	return render(
		<I18nextProvider i18n={i18n}>
			<ResponsiveContext.Provider value={{ width }}>
				<MemoryRouter initialEntries={['/notifications']}>
					<UserDataContext.Provider
						value={
							{
								userData: {
									userId: consultantId,
									grantedAuthorities: [
										'AUTHORIZATION_CONSULTANT_DEFAULT'
									]
								}
							} as never
						}
					>
						<NotificationsContext.Provider
							value={
								{
									notificationFeed: [event],
									markNotificationAsRead: vi.fn(),
									addNotification: vi.fn(),
									refreshNotificationFeed: vi.fn(),
									markAllNotificationsAsRead: vi.fn(),
									loadOlderNotifications: vi.fn(),
									hasOlderNotifications: false
								} as never
							}
						>
							<NotificationsCenter />
							<Location />
						</NotificationsContext.Provider>
					</UserDataContext.Provider>
				</MemoryRouter>
			</ResponsiveContext.Provider>
		</I18nextProvider>
	);
};

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(apiFetchUserDrafts).mockResolvedValue({
		items: [],
		page: 0,
		perPage: 200
	});
	vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
		sessions: [
			{
				session: {
					id: caseId,
					matrixRoomId: room,
					conversationType: 'AGENCY_COUNSELLING'
				}
			}
		]
	} as never);
});
afterEach(cleanup);

it.each([
	['de', 'Weitere Beratung zum selben Thema'],
	['de@informal', 'Weitere Beratung zum selben Thema'],
	['en', 'Another counselling session on the same topic'],
	['fr', 'Un autre accompagnement sur le même thème'],
	['ru', 'Ещё одна консультация по той же теме'],
	['ti', 'ብተመሳሳሊ ኣርእስቲ ተወሳኺ ምኽሪ'],
	['tr', 'Aynı konuda başka bir danışmanlık']
])(
	'renders the actual %s title and body instead of the generic card',
	async (language, title) => {
		const i18n = await locale(language);
		const result = describeActivityEvent(item, i18n.t, language);
		expect(result.title).toBe(title);
		expect(result.text).toBeTruthy();
		expect(result.text).not.toBe(item.text);
		expect(result.text).not.toMatch(/\{\{|example\.invalid|#42/);
	}
);

it.each([
	[item.actionPath, consultantPath],
	[
		`/sessions/consultant/sessionView/${encodeURIComponent(room)}/${caseId}`,
		`/sessions/consultant/sessionView/${encodeURIComponent(room)}/${caseId}`
	]
])(
	'opens the exact authorized case from a mounted desktop card',
	async (actionPath, expectedPath) => {
		await renderCenter({ ...item, actionPath });
		await userEvent.click(openChat());
		await waitFor(() =>
			expect(currentRoute()).toBe(expectedPath + '?topicDuplicate=1')
		);
		expect(apiGetSessionRoomsByRoomIds).not.toHaveBeenCalled();
	}
);

it('opens the same case when the ordinary mobile card is pressed', async () => {
	await renderCenter(item, 390);
	await userEvent.click(
		screen.getByRole('button', {
			name: /Weitere Beratung zum selben Thema/
		})
	);
	await waitFor(() =>
		expect(currentRoute()).toBe(consultantPath + '?topicDuplicate=1')
	);
});

it('keeps the mobile Timeline open if the stored case references disagree', async () => {
	await renderCenter(
		{ ...item, params: { ...item.params, sourceSessionId: caseId + 1 } },
		390
	);
	await userEvent.click(
		screen.getByRole('button', {
			name: /Weitere Beratung zum selben Thema/
		})
	);
	expect(currentRoute()).toBe('/notifications');
	expect(apiGetSessionRoomsByRoomIds).not.toHaveBeenCalled();
});

it('keeps the default conversation list action for an ordinary event without a path', async () => {
	await renderCenter({
		...item,
		eventType: 'legacy.system.event',
		actionPath: undefined,
		sourceSessionId: undefined,
		params: {}
	});
	await userEvent.click(openChat());
	expect(currentRoute()).toBe('/sessions/consultant/sessionView');
});

it.each([
	`/sessions/user/view/${room}/43`,
	`/sessions/user/view/!unrelated:example.invalid/${caseId}`,
	`/sessions/consultant/sessionView/session/${caseId}`,
	`/sessions/user/view/%21old%2Fexample%3Ainvalid/${caseId}`
])(
	'does not offer a desktop action for an unbound path',
	async (actionPath) => {
		await renderCenter({ ...item, actionPath });
		expect(
			screen.queryAllByRole('button', {
				name: 'Chat öffnen',
				exact: true
			})
		).toHaveLength(0);
		expect(currentRoute()).toBe('/notifications');
		expect(apiGetSessionRoomsByRoomIds).not.toHaveBeenCalled();
	}
);
