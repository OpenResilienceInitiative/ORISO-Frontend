// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
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
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import {
	ActiveSessionContext,
	E2EEContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { apiSendMatrixAttachmentMessage, apiSendMessage } from '../../api';

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

beforeEach(() => {
	vi.clearAllMocks();
	sendMock().mockResolvedValue(undefined);
	Object.assign(URL, {
		createObjectURL: vi.fn(() => 'blob:preview'),
		revokeObjectURL: vi.fn()
	});
});
afterEach(cleanup);

describe('picking a file keeps the draft', () => {
	it('from the file picker', async () => {
		const { container } = render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		await pickFile(container, makeFile());

		expect(mocks.composerClear).not.toHaveBeenCalled();
		expect(draftText()).toBe(DRAFT);
		expect(screen.getByText('befund.pdf')).toBeTruthy();
	});

	it('from a file dropped or pasted into the editor', async () => {
		render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		await act(async () => mocks.dropFiles([makeFile()]));

		expect(mocks.composerClear).not.toHaveBeenCalled();
		expect(draftText()).toBe(DRAFT);
		expect(screen.getByText('befund.pdf')).toBeTruthy();
	});

	it('from a file dropped on the session area', async () => {
		const { rerender } = render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		await act(async () => {
			rerender(<Composer preselectedFile={makeFile()} />);
		});

		expect(mocks.composerClear).not.toHaveBeenCalled();
		expect(draftText()).toBe(DRAFT);
		expect(screen.getByText('befund.pdf')).toBeTruthy();
	});

	it('and removing the file leaves the draft alone', async () => {
		const { container } = render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		await pickFile(container, makeFile());
		fireEvent.click(
			screen.getByRole('button', {
				name: 'attachments.composer.remove'
			})
		);

		expect(screen.queryByText('befund.pdf')).toBeNull();
		expect(draftText()).toBe(DRAFT);
	});
});

describe('sending', () => {
	it('sends the draft as the caption of the one file event', async () => {
		const { container } = render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		const file = makeFile();
		await pickFile(container, file);
		await clickSend();

		await waitFor(() => expect(sendMock()).toHaveBeenCalledOnce());
		expect(sendMock().mock.calls[0][1]).toBe(file);
		expect(sendMock().mock.calls[0][2]).toMatchObject({
			caption: DRAFT
		});
		expect(apiSendMessage).not.toHaveBeenCalled();
		await waitFor(() => expect(mocks.composerClear).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.queryByText('befund.pdf')).toBeNull()
		);
	});

	it('sends no caption without a draft', async () => {
		const { container } = render(<Composer />);
		await pickFile(container, makeFile());
		await clickSend();

		await waitFor(() => expect(sendMock()).toHaveBeenCalledOnce());
		expect(sendMock().mock.calls[0][2]?.caption).toBeUndefined();
	});

	it('sends the file the card shows, not an older pick', async () => {
		const { container } = render(<Composer />);
		await pickFile(container, makeFile('old.pdf'));
		const dropped = makeFile('new.pdf');
		await act(async () => mocks.dropFiles([dropped]));
		await clickSend();

		await waitFor(() => expect(sendMock()).toHaveBeenCalledOnce());
		expect(sendMock().mock.calls[0][1]).toBe(dropped);
	});

	it('does not send a dropped file after it was removed from the card', async () => {
		render(<Composer preselectedFile={makeFile()} />);
		await screen.findByText('befund.pdf');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'attachments.composer.remove'
			})
		);
		act(() => mocks.typeDraft(DRAFT));
		await clickSend();

		await waitFor(() => expect(apiSendMessage).toHaveBeenCalledOnce());
		expect(sendMock()).not.toHaveBeenCalled();
	});
});

describe('failures keep the file and the draft', () => {
	const failWith = async (error: unknown) => {
		sendMock().mockRejectedValueOnce(error);
		const view = render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		await pickFile(view.container, makeFile());
		await clickSend();
		await waitFor(() => expect(sendMock()).toHaveBeenCalledOnce());
		return view;
	};

	it.each([
		[
			'a dropped connection',
			Object.assign(new Error('request failed'), {
				name: 'ConnectionError'
			}),
			'attachments.composer.error.network'
		],
		[
			'an XHR with status 0, which the SDK reports as AbortError',
			new DOMException('', 'AbortError'),
			'attachments.composer.error.network'
		],
		[
			'a token service 503',
			Object.assign(new Error('CATCH_ALL'), {
				name: 'MatrixTokenUnavailableError'
			}),
			'attachments.composer.error.service'
		],
		[
			'a homeserver 503',
			Object.assign(new Error('unavailable'), { httpStatus: 503 }),
			'attachments.composer.error.service'
		],
		[
			'an edge 413',
			Object.assign(new Error('too large'), { httpStatus: 413 }),
			'attachments.composer.error.serverTooLarge'
		],
		[
			'anything else',
			new Error('surprise'),
			'attachments.composer.error.other'
		]
	])('after %s', async (_label, error, message) => {
		await failWith(error);

		expect(await screen.findByText(message)).toBeTruthy();
		expect(screen.getByText('befund.pdf')).toBeTruthy();
		expect(draftText()).toBe(DRAFT);
		expect(mocks.composerClear).not.toHaveBeenCalled();
		expect(mocks.clearDraft).not.toHaveBeenCalled();
	});

	it('and retry sends the same file with the same caption', async () => {
		await failWith(Object.assign(new Error('x'), { httpStatus: 503 }));
		const firstFile = sendMock().mock.calls[0][1];
		await act(async () => {
			fireEvent.click(
				await screen.findByRole('button', {
					name: 'attachments.composer.retry'
				})
			);
		});

		await waitFor(() => expect(sendMock()).toHaveBeenCalledTimes(2));
		expect(sendMock().mock.calls[1][1]).toBe(firstFile);
		expect(sendMock().mock.calls[1][2]).toMatchObject({ caption: DRAFT });
		await waitFor(() => expect(mocks.composerClear).toHaveBeenCalled());
	});
});

describe('too large', () => {
	it('is refused before any upload, with the limit, and the draft stays', async () => {
		const { container } = render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		await pickFile(container, makeFile('gross.pdf', 10_000_001));

		expect(screen.getByText('gross.pdf')).toBeTruthy();
		expect(
			screen.getByText('attachments.composer.error.tooLarge')
		).toBeTruthy();
		expect(draftText()).toBe(DRAFT);
		expect(sendMock()).not.toHaveBeenCalled();
		expect(
			(screen.getByRole('button', SEND) as HTMLButtonElement).disabled
		).toBe(true);
	});

	it('takes a file of exactly 10,000,000 bytes', async () => {
		const { container } = render(<Composer />);
		await pickFile(container, makeFile('exact.pdf', 10_000_000));
		await clickSend();

		await waitFor(() => expect(sendMock()).toHaveBeenCalledOnce());
	});
});

describe('progress and cancel', () => {
	const startUpload = async () => {
		let options: any;
		let rejectUpload: (error: unknown) => void = () => {};
		sendMock().mockImplementationOnce(
			(_room, _file, sendOptions) =>
				new Promise((_resolve, reject) => {
					options = sendOptions;
					rejectUpload = reject;
					sendOptions?.abortController?.signal.addEventListener(
						'abort',
						() => reject(new DOMException('Aborted', 'AbortError'))
					);
				})
		);
		const view = render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		await pickFile(view.container, makeFile());
		await clickSend();
		await waitFor(() => expect(sendMock()).toHaveBeenCalledOnce());
		return { options, rejectUpload: () => rejectUpload };
	};

	it('has no number before real bytes are known', async () => {
		await startUpload();

		const bar = screen.getByRole('progressbar');
		expect(bar.getAttribute('aria-valuenow')).toBeNull();
		expect(
			screen.getByText('attachments.composer.status.preparing')
		).toBeTruthy();
	});

	it('shows the real percentage while bytes move', async () => {
		const { options } = await startUpload();
		act(() => options.uploadProgress(42));

		expect(
			screen.getByRole('progressbar').getAttribute('aria-valuenow')
		).toBe('42');
	});

	it('goes back to no number and no cancel once every byte is out', async () => {
		const { options } = await startUpload();
		act(() => options.uploadProgress(100));

		expect(
			screen.getByRole('progressbar').getAttribute('aria-valuenow')
		).toBeNull();
		expect(
			screen.getByText('attachments.composer.status.finishing')
		).toBeTruthy();
		expect(
			screen.queryByRole('button', {
				name: 'attachments.composer.cancel'
			})
		).toBeNull();
	});

	it('cancel aborts, says so, and keeps file and draft for a retry', async () => {
		const { options } = await startUpload();
		act(() => options.uploadProgress(10));
		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', {
					name: 'attachments.composer.cancel'
				})
			);
		});

		expect(options.abortController.signal.aborted).toBe(true);
		expect(
			await screen.findByText('attachments.composer.error.cancelled')
		).toBeTruthy();
		expect(screen.getByText('befund.pdf')).toBeTruthy();
		expect(draftText()).toBe(DRAFT);
		expect(mocks.composerClear).not.toHaveBeenCalled();
	});

	it('cancel also works before the first byte', async () => {
		const { options } = await startUpload();
		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', {
					name: 'attachments.composer.cancel'
				})
			);
		});

		expect(options.abortController.signal.aborted).toBe(true);
	});

	it('locks the draft while the file is on its way', async () => {
		await startUpload();

		expect(
			screen.getByTestId('composer-draft').getAttribute('contenteditable')
		).toBe('false');
	});
});

describe('a file on its way when the person moves to another chat', () => {
	const otherChat = {
		...session,
		item: { ...session.item, id: 361, matrixRoomId: '!other:example.org' }
	};
	const sendThenMove = async () => {
		let settle = {
			resolve: (_value?: unknown) => {},
			reject: (_error: unknown) => {}
		};
		sendMock().mockReturnValueOnce(
			new Promise((resolve, reject) => {
				settle = { resolve, reject };
			}) as any
		);
		const { container, rerender } = render(<Composer />);
		act(() => mocks.typeDraft(DRAFT));
		await pickFile(container, makeFile());
		await clickSend();
		rerender(<Composer activeSession={otherChat} />);
		return settle;
	};

	it('is not offered for a retry there when it fails', async () => {
		const send = await sendThenMove();
		await act(async () => {
			send.reject(Object.assign(new Error('x'), { httpStatus: 503 }));
		});

		expect(screen.queryByText('befund.pdf')).toBeNull();
		expect(
			screen.queryByRole('button', {
				name: 'attachments.composer.retry'
			})
		).toBeNull();
		expect(sendMock()).toHaveBeenCalledTimes(1);
		// The text stays the first chat's draft, for when the person returns.
		expect(mocks.retireDraft).not.toHaveBeenCalled();
	});

	it('does not carry the caption into that chat', async () => {
		await sendThenMove();

		expect(sendMock().mock.calls[0][2]).toMatchObject({ caption: DRAFT });
		expect(draftText()).toBe('');
	});

	it('leaves what is written in that chat alone when it succeeds', async () => {
		const send = await sendThenMove();
		act(() => mocks.typeDraft('For the other chat'));
		mocks.composerClear.mockClear();
		await act(async () => {
			send.resolve();
		});

		await waitFor(() =>
			expect(screen.queryByText('befund.pdf')).toBeNull()
		);
		expect(draftText()).toBe('For the other chat');
		expect(mocks.composerClear).not.toHaveBeenCalled();
		expect(mocks.clearDraft).not.toHaveBeenCalled();
	});

	it('retires the sent caption from the draft of the first chat', async () => {
		const send = await sendThenMove();
		await act(async () => {
			send.resolve();
		});

		await waitFor(() => expect(mocks.retireDraft).toHaveBeenCalledTimes(1));
		expect(mocks.retireDraft).toHaveBeenCalledWith('draft-of-360');
	});
});
