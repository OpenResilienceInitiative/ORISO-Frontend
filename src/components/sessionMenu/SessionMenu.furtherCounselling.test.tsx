// @vitest-environment oriso-jsdom
/**
 * FE#1876: who is offered "Weitere Beratung empfehlen" and
 * "Doppelte Beratung beenden" in the session menu.
 */
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	ConsultingTypesContext,
	SessionsDataContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { SessionMenu } from './SessionMenu';
import { ModalProvider } from '../../globalState/provider/ModalProvider';

vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useSessionTenantSettings', () => ({
	useSessionTenantSettings: () => ({ settings: {}, isLoading: false })
}));
vi.mock('../../hooks/useNotificationSettings', () => ({
	useNotificationSettings: () => ({ settings: {}, updateSettings: vi.fn() })
}));
// Two moderators, so leaving would be allowed in a running group.
vi.mock('../../hooks/useMatrixRoomUsers', () => ({
	useMatrixRoomUsers: () => ({
		users: [],
		moderators: ['@counsellor:m.test', '@other:m.test']
	})
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ releaseToggles: {} })
}));

const endDuplicate = vi.hoisted(() => vi.fn());
vi.mock('../../api/apiFurtherCounselling', () => ({
	apiPutEndTopicDuplicate: (...args: unknown[]) => endDuplicate(...args)
}));
vi.mock('../../api', async (original) => ({
	...(await original<typeof import('../../api')>())
}));

vi.mock('../furtherCounselling/RecommendFurtherCounsellingDialog', () => ({
	RecommendFurtherCounsellingDialog: () => null
}));

const sessionItem = (id: number, extra: Record<string, unknown> = {}) => ({
	id,
	consultingType: 0,
	matrixRoomId: `!room${id}:m.test`,
	status: 2,
	createDate: `2026-10-${String(id).padStart(2, '0')}T10:00:00Z`,
	topic: { id: 7, name: 'Schulden', description: '' },
	...extra
});

const oneOnOne = (
	item: Record<string, unknown>,
	consultantId = 'counsellor'
) => ({
	isSession: true,
	isGroup: false,
	isEnquiry: false,
	rid: item.matrixRoomId,
	item,
	consultant: { id: consultantId }
});

const counsellor = {
	userId: 'counsellor',
	userName: 'counsellor',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
};
const asker = {
	userId: 'asker',
	userName: 'asker',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
};

const renderMenu = ({
	user,
	activeSession,
	sessions = [],
	listType = SESSION_LIST_TYPES.MY_SESSION,
	isSupervisor = false
}: {
	user: unknown;
	activeSession: unknown;
	sessions?: unknown[];
	listType?: string;
	isSupervisor?: boolean;
}) =>
	render(
		<MemoryRouter>
			<ModalProvider>
				<SessionTypeContext.Provider
					value={
						{ type: listType, path: '/sessions/user/view' } as any
					}
				>
					<UserDataContext.Provider value={{ userData: user } as any}>
						<ActiveSessionContext.Provider
							value={
								{
									activeSession,
									reloadActiveSession: vi.fn()
								} as any
							}
						>
							<ConsultingTypesContext.Provider
								value={{ consultingTypes: [{ id: 0 }] } as any}
							>
								<SessionsDataContext.Provider
									value={
										{ dispatch: vi.fn(), sessions } as any
									}
								>
									<SessionMenu
										hasUserInitiatedStopOrLeaveRequest={{
											current: false
										}}
										isAskerInfoAvailable={false}
										isSupervisor={isSupervisor}
										bannedUsers={[]}
									/>
								</SessionsDataContext.Provider>
							</ConsultingTypesContext.Provider>
						</ActiveSessionContext.Provider>
					</UserDataContext.Provider>
				</SessionTypeContext.Provider>
			</ModalProvider>
		</MemoryRouter>
	);

const menuText = () => document.body.textContent ?? '';
const RECOMMEND = 'furtherCounselling.menu.recommend';
const END_DUPLICATE = 'furtherCounselling.menu.endDuplicate';

beforeEach(() => {
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {}
	})) as any;
});
afterEach(cleanup);

describe('SessionMenu — Weitere Beratung empfehlen', () => {
	it('is offered to the owning counsellor of an accepted 1:1 chat', () => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1))
		});
		expect(menuText()).toContain(RECOMMEND);
	});

	it.each([
		[
			'another counsellor',
			{ activeSession: oneOnOne(sessionItem(1), 'someone-else') }
		],
		['the enquiry list', { listType: SESSION_LIST_TYPES.ENQUIRY }],
		['a supervisor', { isSupervisor: true }],
		[
			'a rejected case',
			{ activeSession: oneOnOne(sessionItem(1, { status: 5 })) }
		],
		[
			'a group chat',
			{
				activeSession: {
					...oneOnOne(sessionItem(1)),
					isGroup: true,
					isSession: false
				}
			}
		],
		['the advice seeker', { user: asker }]
	])('is not offered to %s', (_label, change) => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1)),
			...(change as object)
		});
		expect(menuText()).not.toContain(RECOMMEND);
	});
});

describe('SessionMenu — Doppelte Beratung beenden', () => {
	const older = { session: sessionItem(1) };
	const newer = { session: sessionItem(5) };

	it('is offered to the asker in the newer same-topic chat', () => {
		renderMenu({
			user: asker,
			activeSession: oneOnOne(newer.session, 'c2'),
			sessions: [older, newer]
		});
		expect(menuText()).toContain(END_DUPLICATE);
	});

	it('is not offered in the older chat', () => {
		renderMenu({
			user: asker,
			activeSession: oneOnOne(older.session, 'c1'),
			sessions: [older, newer]
		});
		expect(menuText()).not.toContain(END_DUPLICATE);
	});

	it('is not offered to the counsellor of the newer chat', () => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(newer.session),
			sessions: [older, newer]
		});
		expect(menuText()).not.toContain(END_DUPLICATE);
	});

	it('follows the backend flag', () => {
		renderMenu({
			user: asker,
			activeSession: oneOnOne(
				sessionItem(5, { isTopicDuplicate: false }),
				'c2'
			),
			sessions: [older, newer]
		});
		expect(menuText()).not.toContain(END_DUPLICATE);
	});

	it('asks for confirmation before ending the duplicate', async () => {
		// FocusTrap stays real; jsdom lacks the geometry tabbable reads.
		const rects = vi
			.spyOn(HTMLElement.prototype, 'getClientRects')
			.mockImplementation(
				() => [{ width: 100, height: 40 }] as unknown as DOMRectList
			);
		const overlay = document.createElement('div');
		overlay.id = 'overlay';
		document.body.append(overlay);
		endDuplicate.mockResolvedValue(undefined);
		renderMenu({
			user: asker,
			activeSession: oneOnOne(newer.session, 'c2'),
			sessions: [older, newer]
		});
		fireEvent.click(screen.getByText(END_DUPLICATE));
		expect(
			await screen.findByText(
				'furtherCounselling.duplicate.confirm.headline'
			)
		).toBeTruthy();
		expect(endDuplicate).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByText('furtherCounselling.duplicate.confirm.confirm')
		);
		await waitFor(() => expect(endDuplicate).toHaveBeenCalledWith(5));
		overlay.remove();
		rects.mockRestore();
	});
});
