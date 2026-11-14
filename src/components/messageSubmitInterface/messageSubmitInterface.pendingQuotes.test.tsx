// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
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
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import {
	ActiveSessionContext,
	E2EEContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { apiPutDearchive, apiSendMatrixAttachmentMessage } from '../../api';
import { chatTransportService } from '../../services/chatTransportService';

const mocks = vi.hoisted(() => ({
	clearDraft: vi.fn().mockResolvedValue(undefined),
	retireDraft: vi.fn().mockResolvedValue(undefined),
	draftChange: vi.fn(),
	encryptRoom: vi.fn().mockResolvedValue(undefined),
	translate: (key: string) => key,
	composerClear: vi.fn(),
	typeDraft: (_text: string) => {},
	dropFiles: (_files: File[]) => {},
	matrixService: { getClient: () => null }
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: mocks.translate,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));
vi.mock('../../globalState', async () => {
	const react = await import('react');
	return {
		AUTHORITIES: {
			ASKER_DEFAULT: 'ASKER',
			CONSULTANT_DEFAULT: 'CONSULTANT'
		},
		hasUserAuthority: (
			authority: string,
			user: { grantedAuthorities?: string[] }
		) => user?.grantedAuthorities?.includes(authority) || false,
		getContact: () => ({ username: 'Counsellor' }),
		useTenant: () => ({ settings: {} }),
		UserDataContext: react.createContext(null),
		ActiveSessionContext: react.createContext(null),
		SessionTypeContext: react.createContext(null),
		E2EEContext: react.createContext(null)
	};
});
vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({ matrixClientService: mocks.matrixService })
}));
vi.mock('../../api', () => ({
	apiSendMatrixAttachmentMessage: vi.fn().mockResolvedValue(undefined),
	apiSendMessage: vi.fn().mockResolvedValue(undefined),
	apiGetSessionSupervisors: vi.fn().mockResolvedValue([]),
	fetchAgencyConsultantList: vi.fn().mockResolvedValue([]),
	apiPutDearchive: vi.fn().mockResolvedValue(undefined),
	apiSendEnquiry: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../api/apiTemporaryAccount', () => ({
	apiGetTemporaryAccount: vi.fn(() => Promise.resolve(null)),
	apiPutMessageRetention: vi.fn()
}));
vi.mock('../../api/apiPostError', () => ({
	apiPostError: vi.fn().mockResolvedValue(undefined),
	ERROR_LEVEL_WARN: 'warn'
}));
vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({ ready: true, encryptRoom: mocks.encryptRoom })
}));
vi.mock('../../hooks/useE2EEViewElements', () => ({
	useE2EEViewElements: () => ({ visible: false, setState: mocks.draftChange })
}));
vi.mock('../../hooks/useTimeoutOverlay', () => ({
	useTimeoutOverlay: () => ({ visible: false })
}));
vi.mock('./useDraftMessage', () => ({
	useDraftMessage: (_enabled: boolean, _load: unknown, options: any) => ({
		loaded: true,
		onChange: mocks.draftChange,
		clearDraftMessage: mocks.clearDraft,
		draftScope: `draft-of-${options.sessionId}`,
		retireDraftScope: mocks.retireDraft
	})
}));
vi.mock('./TipTapComposer', async () => {
	const react = await import('react');
	return {
		TipTapComposer: react.forwardRef((props: any, ref) => {
			const valueRef = react.useRef('');
			valueRef.current = props.value ?? '';
			mocks.typeDraft = props.onChange;
			mocks.dropFiles = props.onFilesSelected;
			react.useImperativeHandle(ref, () => ({
				getHTML: () => valueRef.current,
				clear: () => mocks.composerClear(),
				runAction: () => {},
				isActionActive: () => false,
				setInsertionMarker: () => {},
				setText: () => {},
				focus: () => {}
			}));
			return (
				<div
					contentEditable={!props.readOnly}
					suppressContentEditableWarning
					data-testid="composer-draft"
				>
					{props.value}
				</div>
			);
		})
	};
});

const DRAFT = 'Please read page 2';
const SEND = { name: 'enquiry.write.input.button.title' };
const session = {
	rid: null,
	isGroup: false,
	isSession: true,
	item: {
		id: 360,
		agencyId: 101,
		matrixRoomId: '!case:example.org',
		status: 'ACTIVE',
		registrationType: 'REGISTERED',
		messageDate: 1,
		conversationType: 'AGENCY_COUNSELLING'
	},
	consultant: {},
	user: { username: 'client', sessionData: {} }
};

function Composer({
	activeSession = session,
	...props
}: Partial<React.ComponentProps<typeof MessageSubmitInterfaceComponent>> & {
	activeSession?: typeof session;
}) {
	return (
		<MemoryRouter>
			<ActiveSessionContext.Provider
				value={
					{
						activeSession,
						reloadActiveSession: mocks.draftChange
					} as any
				}
			>
				<UserDataContext.Provider
					value={
						{
							userData: {
								userId: 'counsellor',
								grantedAuthorities: ['CONSULTANT'],
								agencies: []
							}
						} as any
					}
				>
					<SessionTypeContext.Provider
						value={{ type: 'session', path: '/sessions' } as any}
					>
						<E2EEContext.Provider
							value={{ isE2eeEnabled: true } as any}
						>
							<MessageSubmitInterfaceComponent
								placeholder="Message"
								autoFocusEditor={false}
								{...props}
							/>
						</E2EEContext.Provider>
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
			</ActiveSessionContext.Provider>
		</MemoryRouter>
	);
}

const makeFile = (
	name = 'befund.pdf',
	size = 2048,
	type = 'application/pdf'
) => {
	const file = new File(['pdf'], name, { type });
	Object.defineProperty(file, 'size', { value: size });
	return file;
};

const pickFile = async (container: HTMLElement, file: File) => {
	const input = container.querySelector(
		'input[type="file"]'
	) as HTMLInputElement;
	Object.defineProperty(input, 'files', {
		configurable: true,
		value: [file]
	});
	await act(async () => {
		fireEvent.change(input);
	});
};

const clickSend = async () => {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', SEND));
	});
};

const draftText = () => screen.getByTestId('composer-draft').textContent;
const sendMock = () => vi.mocked(apiSendMatrixAttachmentMessage);

const QUOTES = [
	{ id: 'q1', eventId: '$ev1', author: 'Client', excerpt: 'marked passage' }
];

beforeEach(() => {
	vi.clearAllMocks();
	sendMock().mockResolvedValue(undefined);
	Object.assign(URL, {
		createObjectURL: vi.fn(() => 'blob:preview'),
		revokeObjectURL: vi.fn()
	});
});
afterEach(() => cleanup());

describe('sending queued passage quotes (PR #2232 review)', () => {
	it('sends the quotes together with the typed text (unchanged)', async () => {
		const onSendPendingQuotes = vi.fn();
		render(
			<Composer
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
			/>
		);
		act(() => mocks.typeDraft(DRAFT));
		await clickSend();
		expect(onSendPendingQuotes).toHaveBeenCalledWith(DRAFT);
	});

	it('does not send quotes past the length limit, and keeps the draft', async () => {
		const onSendPendingQuotes = vi.fn();
		render(
			<Composer
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
			/>
		);
		const tooLong = 'x'.repeat(7501);
		act(() => mocks.typeDraft(tooLong));
		await clickSend();
		expect(onSendPendingQuotes).not.toHaveBeenCalled();
		expect(mocks.clearDraft).not.toHaveBeenCalled();
		expect(draftText()).toBe(tooLong);
	});

	it('does not send quotes while a refused file waits on the card', async () => {
		const onSendPendingQuotes = vi.fn();
		const { container } = render(
			<Composer
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
			/>
		);
		act(() => mocks.typeDraft(DRAFT));
		await pickFile(container, makeFile('gross.pdf', 10_000_001));
		await clickSend();
		expect(onSendPendingQuotes).not.toHaveBeenCalled();
		expect(draftText()).toBe(DRAFT);
		expect(
			(screen.getByRole('button', SEND) as HTMLButtonElement).disabled
		).toBe(true);
	});

	it('submits an active edit as the edit and keeps the queued quotes', async () => {
		const onSendPendingQuotes = vi.fn();
		render(
			<Composer
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
				editingMessage={{ eventId: '$edited', text: 'old text' }}
				onCancelEdit={vi.fn()}
			/>
		);
		const editTextMessage = vi
			.spyOn(chatTransportService, 'editTextMessage')
			.mockResolvedValue(undefined as any);
		act(() => mocks.typeDraft('corrected text'));
		await clickSend();
		expect(editTextMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				matrixRoomId: '!case:example.org',
				targetEventId: '$edited',
				message: expect.stringContaining('corrected text')
			})
		);
		expect(onSendPendingQuotes).not.toHaveBeenCalled();
		expect(screen.getByText(/marked passage/)).toBeTruthy();
	});

	const archived = {
		...session,
		item: { ...session.item, status: 4 as unknown as string }
	};

	it('keeps quotes and draft in an archived chat that may not be re-opened', async () => {
		const onSendPendingQuotes = vi.fn();
		render(
			<Composer
				activeSession={archived}
				allowDearchive={false}
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
			/>
		);
		act(() => mocks.typeDraft(DRAFT));
		await clickSend();
		expect(onSendPendingQuotes).not.toHaveBeenCalled();
		expect(vi.mocked(apiPutDearchive)).not.toHaveBeenCalled();
		expect(mocks.clearDraft).not.toHaveBeenCalled();
		expect(draftText()).toBe(DRAFT);
	});

	it('re-opens an archived chat before the quotes go out', async () => {
		const order: string[] = [];
		vi.mocked(apiPutDearchive).mockImplementation(async () => {
			order.push('dearchive');
		});
		const onSendPendingQuotes = vi.fn(() => order.push('quotes'));
		render(
			<Composer
				activeSession={archived}
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
			/>
		);
		act(() => mocks.typeDraft(DRAFT));
		await clickSend();
		expect(order).toEqual(['dearchive', 'quotes']);
		expect(onSendPendingQuotes).toHaveBeenCalledWith(DRAFT);
		expect(mocks.clearDraft).toHaveBeenCalled();
	});

	const pendingDearchive = () => {
		let resolve!: () => void;
		vi.mocked(apiPutDearchive).mockImplementationOnce(
			() => new Promise<void>((done) => (resolve = done)) as any
		);
		return () => act(async () => resolve());
	};

	it('sends the quotes once when send is pressed twice while re-opening', async () => {
		const finish = pendingDearchive();
		const onSendPendingQuotes = vi.fn();
		render(
			<Composer
				activeSession={archived}
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
			/>
		);
		act(() => mocks.typeDraft(DRAFT));
		await clickSend();
		await clickSend();
		await finish();
		expect(vi.mocked(apiPutDearchive)).toHaveBeenCalledTimes(1);
		expect(onSendPendingQuotes).toHaveBeenCalledTimes(1);
	});

	it('keeps text typed while the chat re-opens', async () => {
		const finish = pendingDearchive();
		const onSendPendingQuotes = vi.fn();
		render(
			<Composer
				activeSession={archived}
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
			/>
		);
		act(() => mocks.typeDraft(DRAFT));
		await clickSend();
		act(() => mocks.typeDraft(`${DRAFT} and page 3`));
		await finish();
		expect(onSendPendingQuotes).toHaveBeenCalledWith(DRAFT);
		expect(mocks.clearDraft).not.toHaveBeenCalled();
		expect(draftText()).toBe(`${DRAFT} and page 3`);
	});

	it('keeps the draft when re-opening the archived chat fails', async () => {
		vi.mocked(apiPutDearchive).mockRejectedValueOnce(new Error('403'));
		const onSendPendingQuotes = vi.fn();
		render(
			<Composer
				activeSession={archived}
				pendingQuotes={QUOTES}
				onSendPendingQuotes={onSendPendingQuotes}
			/>
		);
		act(() => mocks.typeDraft(DRAFT));
		await clickSend();
		expect(onSendPendingQuotes).not.toHaveBeenCalled();
		expect(draftText()).toBe(DRAFT);
	});
});
