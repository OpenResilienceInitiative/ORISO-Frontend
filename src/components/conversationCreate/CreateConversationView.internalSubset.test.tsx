// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiCreateInternalSubsetChat,
	InternalSubsetChatError,
	INTERNAL_SUBSET_REASON
} from '../../api/apiCreateInternalSubsetChat';
import { apiCreateGroupChat } from '../../api/apiGroupChatSettings';
import { apiGetSessionRoomsByRoomIds } from '../../api/apiGetSessionRooms';
import {
	apiGetTenantConsultantList,
	Consultant,
	fetchAgencyConsultantList
} from '../../api/apiGetAgencyConsultantList';
import { useSession } from '../../hooks/useSession';
import { UserDataContext, SessionsDataContext } from '../../globalState';
import { CreateConversationView } from './CreateConversationView';
import { resetCounsellorAgencyFormatsForTests } from '../../hooks/useCounsellorAgencyFormats';

// react-i18next: identity translator so we can assert on keys.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

const tenantState = vi.hoisted(() => ({
	tenant: {} as Record<string, unknown>
}));

// The globalState barrel pulls lottie-web (crashes in jsdom): stub the parts
// the flow reads.
vi.mock('../../globalState', async () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	const { UserDataContext } = await vi.importActual<any>(
		'../../globalState/context/UserDataContext'
	);
	return {
		UserDataContext,
		NotificationsContext: react.createContext(null),
		SessionsDataContext: react.createContext({ dispatch: () => {} }),
		UPDATE_SESSIONS: 'UPDATE_SESSIONS',
		useTenant: () => tenantState.tenant,
		useTenantState: () => ({ tenant: tenantState.tenant, isLoading: false })
	};
});
vi.mock('../app/navigationHandler', () => ({
	desktopView: vi.fn(),
	mobileDetailView: vi.fn(),
	mobileListView: vi.fn()
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true })
}));
vi.mock('../../hooks/useSession', () => ({ useSession: vi.fn() }));
vi.mock('../../api/apiGetAgencyConsultantList', () => ({
	apiGetTenantConsultantList: vi.fn(),
	fetchAgencyConsultantList: vi.fn()
}));
vi.mock('../../api/apiGetAgenciesByIds', () => ({
	apiGetAgenciesByIds: vi.fn().mockResolvedValue([])
}));
vi.mock('../../api/apiGetTenantAgenciesTopics', () => ({
	apiGetTenantAgenciesTopics: vi.fn().mockResolvedValue([])
}));
vi.mock('../../api/apiGroupChatSettings', () => ({
	apiCreateGroupChat: vi.fn(),
	apiUpdateGroupChat: vi.fn()
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: vi.fn()
}));
vi.mock('../../api/apiCreateInternalSubsetChat', async () => {
	const actual = await vi.importActual<
		typeof import('../../api/apiCreateInternalSubsetChat')
	>('../../api/apiCreateInternalSubsetChat');
	return { ...actual, apiCreateInternalSubsetChat: vi.fn() };
});
vi.mock(
	'../../resources/img/illustrations/conversation/internal-team.png',
	() => ({ default: 'internal-team.png' })
);
// Stub only the image lookups; keep every other export real, so a new one
// (getTopicCardArtwork arrived with #1814) does not throw on first render.
vi.mock('../../resources/img/topics', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../resources/img/topics')>()),
	getTopicCardImage: () => 'topic.png',
	hasTopicCardImage: () => false,
	topicSlug: (value: string) => value
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<any>('react-router-dom');
	return {
		...actual,
		useNavigate: () => navigate,
		useLocation: () => ({ state: null }),
		useParams: () => ({})
	};
});

const colleague = (
	consultantId: string,
	firstName: string,
	agencyIds: number[]
): Consultant => ({
	consultantId,
	firstName,
	lastName: 'Test',
	displayName: firstName,
	username: firstName.toLowerCase(),
	agencies: agencyIds.map((id) => ({ id }))
});

const sameCentre = colleague('c-same', 'Anna', [5]);
const otherCentre = colleague('c-other', 'Boris', [9]);

const renderView = (
	agencies: { id: number; name: string }[] = [{ id: 5, name: 'Agency Five' }]
) =>
	render(
		<UserDataContext.Provider
			value={{
				userData: {
					userId: 'me',
					agencies
				}
			}}
		>
			<SessionsDataContext.Provider value={{ dispatch: vi.fn() }}>
				<CreateConversationView />
			</SessionsDataContext.Provider>
		</UserDataContext.Provider>
	);

const tenantWithScope = (scope?: 'AGENCY' | 'TENANT' | 'PLATFORM') => ({
	settings: { featureGroupChatV2Enabled: true, activeLanguages: ['de'] },
	...(scope && { internalGroupChat: { recipientScope: { value: scope } } })
});

const openPersonMenu = async () => {
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'groupChat.internal.addPerson'
		})
	);
	return screen.findByRole('listbox');
};

describe('Interna picker with the recipient scope (#1772)', () => {
	beforeEach(() => {
		vi.mocked(useSession).mockReturnValue({
			session: undefined,
			reload: vi.fn(),
			read: vi.fn(),
			ready: true
		} as any);
		vi.mocked(fetchAgencyConsultantList).mockResolvedValue([sameCentre]);
		vi.mocked(apiGetTenantConsultantList).mockResolvedValue([
			sameCentre,
			otherCentre
		]);
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: []
		} as any);
	});
	afterEach(() => {
		cleanup();
		resetCounsellorAgencyFormatsForTests();
		vi.clearAllMocks();
	});

	it('offers only colleagues of the counselling centre when the Träger has not widened the scope', async () => {
		tenantState.tenant = tenantWithScope();
		renderView();

		const menu = await openPersonMenu();

		await waitFor(() =>
			expect(within(menu).getByText('Anna Test')).toBeTruthy()
		);
		expect(within(menu).queryByText('Boris Test')).toBeNull();
		expect(fetchAgencyConsultantList).toHaveBeenCalledWith('5');
		expect(
			screen.getByText('groupChat.internal.scope.AGENCY', {
				exact: false
			})
		).toBeTruthy();
	});

	it.each(['TENANT', 'PLATFORM'] as const)(
		'offers the whole directory for the scope %s',
		async (scope) => {
			tenantState.tenant = tenantWithScope(scope);
			renderView();

			const menu = await openPersonMenu();

			await waitFor(() =>
				expect(within(menu).getByText('Boris Test')).toBeTruthy()
			);
			expect(within(menu).getByText('Anna Test')).toBeTruthy();
			expect(
				screen.getByText('groupChat.internal.scope.TENANT', {
					exact: false
				})
			).toBeTruthy();
		}
	);

	it('sends the picked colleague to a dedicated room and nobody else', async () => {
		tenantState.tenant = tenantWithScope('TENANT');
		vi.mocked(apiCreateInternalSubsetChat).mockResolvedValue({
			matrixRoomId: '!room:matrix.test',
			chatId: 321,
			reused: false
		});
		renderView();

		const menu = await openPersonMenu();
		fireEvent.click(await within(menu).findByText('Boris Test'));
		fireEvent.change(
			screen.getByLabelText('groupChat.internal.nameLabel'),
			{ target: { value: 'Fallbesprechung' } }
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.internal.createLabel'
			})
		);

		await waitFor(() =>
			expect(apiCreateInternalSubsetChat).toHaveBeenCalledWith({
				consultantIds: ['c-other'],
				agencyId: 5,
				topic: 'Fallbesprechung'
			})
		);
		expect(apiCreateGroupChat).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith(
				'/sessions/consultant/sessionView/!room%3Amatrix.test/321'
			)
		);
	});

	it.each([
		[
			INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE,
			'groupChat.internal.error.outOfScope'
		],
		[
			INTERNAL_SUBSET_REASON.ENCRYPTION_REQUIRED,
			'groupChat.internal.error.encryptionRequired'
		]
	])(
		'shows the refusal %s as a readable message and stays on the picker',
		async (reason, key) => {
			tenantState.tenant = tenantWithScope('TENANT');
			vi.mocked(apiCreateInternalSubsetChat).mockRejectedValue(
				new InternalSubsetChatError(reason, 403)
			);
			renderView();

			const menu = await openPersonMenu();
			fireEvent.click(await within(menu).findByText('Anna Test'));
			fireEvent.change(
				screen.getByLabelText('groupChat.internal.nameLabel'),
				{ target: { value: 'Fallbesprechung' } }
			);
			fireEvent.click(
				screen.getByRole('button', {
					name: 'groupChat.internal.createLabel'
				})
			);

			expect((await screen.findByRole('alert')).textContent).toBe(key);
			expect(navigate).not.toHaveBeenCalled();
		}
	);

	it('keeps the refusal while the name is typed and drops it when the selection changes', async () => {
		tenantState.tenant = tenantWithScope('TENANT');
		vi.mocked(apiCreateInternalSubsetChat).mockRejectedValue(
			new InternalSubsetChatError(
				INTERNAL_SUBSET_REASON.MEMBERSHIP_FAILED,
				502
			)
		);
		renderView();

		const menu = await openPersonMenu();
		fireEvent.click(await within(menu).findByText('Anna Test'));
		const name = screen.getByLabelText('groupChat.internal.nameLabel');
		fireEvent.change(name, { target: { value: 'Fallbesprechung' } });
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.internal.createLabel'
			})
		);
		await screen.findByRole('alert');

		fireEvent.change(name, { target: { value: 'Fallbesprechung 2' } });
		expect(screen.queryByRole('alert')).not.toBeNull();

		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.internal.removePerson'
			})
		);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('drops the refusal of one centre when another centre is chosen', async () => {
		tenantState.tenant = tenantWithScope();
		vi.mocked(fetchAgencyConsultantList).mockImplementation(
			(agencyId: string) =>
				Promise.resolve(
					agencyId === '5'
						? [sameCentre]
						: [colleague('c-six', 'Cem', [6])]
				)
		);
		vi.mocked(apiCreateInternalSubsetChat).mockRejectedValue(
			new InternalSubsetChatError(
				INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE,
				403
			)
		);
		renderView([
			{ id: 5, name: 'Agency Five' },
			{ id: 6, name: 'Agency Six' }
		]);

		fireEvent.mouseDown((await screen.findAllByRole('combobox'))[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency Five' })
		);
		const menu = await openPersonMenu();
		fireEvent.click(await within(menu).findByText('Anna Test'));
		fireEvent.change(
			screen.getByLabelText('groupChat.internal.nameLabel'),
			{ target: { value: 'Fallbesprechung' } }
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.internal.createLabel'
			})
		);
		await screen.findByRole('alert');

		fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency Six' })
		);

		await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
	});

	describe('a create request that is still pending', () => {
		const startPendingCreate = async () => {
			tenantState.tenant = tenantWithScope();
			vi.mocked(fetchAgencyConsultantList).mockImplementation(
				(agencyId: string) =>
					Promise.resolve(
						agencyId === '5'
							? [sameCentre]
							: [colleague('c-six', 'Cem', [6])]
					)
			);
			let refuse: (error: Error) => void = () => undefined;
			vi.mocked(apiCreateInternalSubsetChat).mockReturnValue(
				new Promise((_resolve, reject) => {
					refuse = reject;
				})
			);
			renderView([
				{ id: 5, name: 'Agency Five' },
				{ id: 6, name: 'Agency Six' }
			]);
			fireEvent.mouseDown((await screen.findAllByRole('combobox'))[0]);
			fireEvent.click(
				await screen.findByRole('option', { name: 'Agency Five' })
			);
			const menu = await openPersonMenu();
			fireEvent.click(await within(menu).findByText('Anna Test'));
			fireEvent.change(
				screen.getByLabelText('groupChat.internal.nameLabel'),
				{ target: { value: 'Fallbesprechung' } }
			);
			fireEvent.click(
				screen.getByRole('button', {
					name: 'groupChat.internal.createLabel'
				})
			);
			await waitFor(() =>
				expect(apiCreateInternalSubsetChat).toHaveBeenCalledTimes(1)
			);
			return () =>
				act(async () =>
					refuse(
						new InternalSubsetChatError(
							INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE,
							403
						)
					)
				);
		};

		it('does not show its refusal after another centre was chosen', async () => {
			const refuseOldRequest = await startPendingCreate();

			fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
			fireEvent.click(
				await screen.findByRole('option', { name: 'Agency Six' })
			);
			await refuseOldRequest();

			expect(screen.queryByRole('alert')).toBeNull();
		});

		it('does not show its refusal after the selection was changed', async () => {
			const refuseOldRequest = await startPendingCreate();

			fireEvent.click(
				screen.getByRole('button', {
					name: 'groupChat.internal.removePerson'
				})
			);
			await refuseOldRequest();

			expect(screen.queryByRole('alert')).toBeNull();
		});

		it('still shows its refusal when only the name was edited', async () => {
			const refuseOldRequest = await startPendingCreate();

			fireEvent.change(
				screen.getByLabelText('groupChat.internal.nameLabel'),
				{ target: { value: 'Fallbesprechung 2' } }
			);
			await refuseOldRequest();

			expect(screen.queryByRole('alert')).not.toBeNull();
		});
	});

	it('never lets a late answer for the previous centre replace the list of the current one', async () => {
		tenantState.tenant = tenantWithScope();
		let answerFirstCentre: (list: Consultant[]) => void = () => undefined;
		vi.mocked(fetchAgencyConsultantList).mockImplementation(
			(agencyId: string) =>
				agencyId === '5'
					? new Promise((resolve) => {
							answerFirstCentre = resolve as never;
						})
					: Promise.resolve([colleague('c-six', 'Cem', [6])])
		);
		renderView([
			{ id: 5, name: 'Agency Five' },
			{ id: 6, name: 'Agency Six' }
		]);

		fireEvent.mouseDown((await screen.findAllByRole('combobox'))[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency Five' })
		);
		await waitFor(() =>
			expect(fetchAgencyConsultantList).toHaveBeenCalledWith('5')
		);
		fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency Six' })
		);
		await waitFor(() =>
			expect(fetchAgencyConsultantList).toHaveBeenCalledWith('6')
		);

		// The slow answer for centre five arrives last.
		await act(async () => answerFirstCentre([sameCentre]));

		const menu = await openPersonMenu();
		await waitFor(() =>
			expect(within(menu).getByText('Cem Test')).toBeTruthy()
		);
		expect(within(menu).queryByText('Anna Test')).toBeNull();
	});

	it('shows no colleague of the previous centre while the new list loads', async () => {
		tenantState.tenant = tenantWithScope();
		vi.mocked(fetchAgencyConsultantList).mockImplementation(
			(agencyId: string) =>
				agencyId === '5'
					? Promise.resolve([sameCentre])
					: new Promise(() => undefined)
		);
		renderView([
			{ id: 5, name: 'Agency Five' },
			{ id: 6, name: 'Agency Six' }
		]);

		fireEvent.mouseDown((await screen.findAllByRole('combobox'))[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency Five' })
		);
		await waitFor(() =>
			expect(fetchAgencyConsultantList).toHaveBeenCalledWith('5')
		);
		fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency Six' })
		);

		const menu = await openPersonMenu();
		expect(within(menu).queryByText('Anna Test')).toBeNull();
	});
});
