// @vitest-environment oriso-jsdom
/**
 * FE#2250: "Beratung übergeben" in the chat-room menu of a 1:1 conversation.
 * Same audience as "Weitere Beratung empfehlen", same handover dialog and the
 * same pending state as the profile button (AskerInfoAssign).
 */
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
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
import {
	apiGetCaseHandoverReasons,
	apiGetCaseHandoverRecipients,
	apiGetCaseHandoverStatus
} from '../../api/apiCaseHandover';
import { resetCaseHandoverOperationStoreForTests } from '../caseHandover/caseHandoverOperationStore';
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

vi.mock('../../api/apiFurtherCounselling', () => ({
	apiPutEndTopicDuplicate: vi.fn()
}));
vi.mock('../../api', async (original) => ({
	...(await original<typeof import('../../api')>())
}));

vi.mock('../../api/apiCaseHandover', () => ({
	apiCreateCaseHandoverOffer: vi.fn(),
	apiGetCaseHandoverReasons: vi.fn(),
	apiGetCaseHandoverRecipients: vi.fn(),
	apiGetCaseHandoverRequestStatus: vi.fn(),
	apiGetCaseHandoverStatus: vi.fn(),
	apiWithdrawCaseHandoverOffer: vi.fn()
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

const HANDOVER = 'caseHandover.offer.open';
const RECOMMEND = 'furtherCounselling.menu.recommend';

const menuItems = () =>
	Array.from(
		document.querySelectorAll<HTMLElement>('.sessionMenu__item')
	).map((item) => item.textContent ?? '');

beforeEach(() => {
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {}
	})) as any;
	vi.clearAllMocks();
	resetCaseHandoverOperationStoreForTests();
	vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
		sessionId: 1,
		status: 'ACTIVE_OWNER',
		canViewContent: true,
		clientConsentRequired: false,
		ownershipRevision: 3
	} as any);
	vi.mocked(apiGetCaseHandoverRecipients).mockResolvedValue([
		{ consultantId: 'colleague-1', displayName: 'Marge Kollegin' }
	] as any);
	vi.mocked(apiGetCaseHandoverReasons).mockResolvedValue([
		{ code: 'PLANNED_ABSENCE', label: 'Freistellung' }
	] as any);
});
afterEach(cleanup);

describe('SessionMenu — Beratung übergeben (#2250)', () => {
	it('sits directly below "Weitere Beratung empfehlen" for the owning counsellor', () => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1))
		});
		const items = menuItems();
		const recommendAt = items.findIndex((text) => text.includes(RECOMMEND));
		expect(recommendAt).toBeGreaterThanOrEqual(0);
		expect(items[recommendAt + 1]).toContain(HANDOVER);
	});

	it('sits in the folded "Beratung weitergeben" group, closed until opened', () => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1))
		});
		fireEvent.click(screen.getAllByRole('button', { name: 'app.menu' })[0]);
		const toggle = screen.getByRole('button', {
			name: 'sessionMenu.group.handover'
		});
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByRole('button', { name: HANDOVER })).toBeNull();
		fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByRole('button', { name: HANDOVER })).toBeTruthy();
	});

	it('starts with the group closed again on the next opening', () => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1))
		});
		const trigger = screen.getAllByRole('button', { name: 'app.menu' })[0];
		const handoverToggle = () =>
			screen.getByRole('button', { name: 'sessionMenu.group.handover' });
		fireEvent.click(trigger);
		fireEvent.click(handoverToggle());
		expect(handoverToggle().getAttribute('aria-expanded')).toBe('true');
		fireEvent.click(trigger);
		fireEvent.click(trigger);
		expect(handoverToggle().getAttribute('aria-expanded')).toBe('false');
	});

	it('lets ArrowDown move past the closed group to the next row', () => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1))
		});
		fireEvent.click(screen.getAllByRole('button', { name: 'app.menu' })[0]);
		const toggle = screen.getByRole('button', {
			name: 'sessionMenu.group.handover'
		});
		toggle.focus();
		fireEvent.keyDown(toggle, { key: 'ArrowDown' });
		const focused = document.activeElement as HTMLElement;
		expect(focused).not.toBe(toggle);
		expect(focused.closest('[hidden]')).toBeNull();
	});

	it.each([
		[
			'another counsellor',
			{ activeSession: oneOnOne(sessionItem(1), 'someone-else') }
		],
		['the enquiry list', { listType: SESSION_LIST_TYPES.ENQUIRY }],
		['a supervisor', { isSupervisor: true }],
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
		['the advice seeker', { user: asker }],
		[
			'a Teamberatung case (FE#2494 *4)',
			{ activeSession: oneOnOne(sessionItem(1, { isTeamSession: true })) }
		]
	])('is not offered to %s', (_label, change) => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1)),
			...(change as object)
		});
		expect(document.body.textContent).not.toContain(HANDOVER);
	});

	it('opens the same handover dialog as the profile button', async () => {
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1))
		});
		fireEvent.click(screen.getByText(HANDOVER));

		// The loading dialog comes first; wait for the form itself.
		const person = await screen.findByRole('combobox', {
			name: 'supervisorDialog.personLabel.handover'
		});
		const dialog = person.closest<HTMLElement>('[role="dialog"]');
		expect(dialog).toBeTruthy();
		expect(
			within(dialog as HTMLElement).getByText(
				'supervisorDialog.title.handover'
			)
		).toBeTruthy();
		expect(apiGetCaseHandoverStatus).toHaveBeenCalledWith(1);
		expect(apiGetCaseHandoverRecipients).toHaveBeenCalledWith(1);
	});

	it('shows progress in a dialog while the handover form loads', async () => {
		vi.mocked(apiGetCaseHandoverStatus).mockReturnValue(
			new Promise(() => undefined) as any
		);
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1))
		});
		fireEvent.click(screen.getByText(HANDOVER));

		const dialog = await screen.findByTestId('case-handover-state-dialog');
		expect(within(dialog).getByRole('status').textContent).toBe(
			'caseHandover.offer.loading'
		);
		expect(
			within(dialog).getAllByRole('button', {
				name: 'supervisorDialog.close'
			}).length
		).toBeGreaterThan(0);
	});

	it('shows the pending offer instead of opening a second offer form', async () => {
		vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
			sessionId: 1,
			status: 'ACTIVE_OWNER',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 3,
			openOffer: {
				sessionId: 1,
				requestId: 77,
				status: 'PENDING_RECIPIENT_ACCEPTANCE'
			}
		} as any);
		renderMenu({
			user: counsellor,
			activeSession: oneOnOne(sessionItem(1))
		});
		fireEvent.click(screen.getByText(HANDOVER));

		expect(
			await screen.findByText(
				'caseHandover.offer.status.PENDING_RECIPIENT_ACCEPTANCE'
			)
		).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'caseHandover.offer.withdraw' })
		).toBeTruthy();
		expect(
			screen.queryByRole('combobox', {
				name: 'supervisorDialog.personLabel.handover'
			})
		).toBeNull();
	});
});
