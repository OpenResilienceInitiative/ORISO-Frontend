// @vitest-environment jsdom
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
	draftChange: vi.fn(),
	draftEnabled: vi.fn(),
	encryptRoom: vi.fn().mockResolvedValue(undefined),
	translate: (key: string) => key,
	matrixService: { getClient: () => null }
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: mocks.translate })
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
	useDraftMessage: (enabled: boolean) => {
		mocks.draftEnabled(enabled);
		return {
			loaded: true,
			onChange: mocks.draftChange,
			clearDraftMessage: mocks.clearDraft
		};
	}
}));
vi.mock('./TipTapComposer', async () => {
	const react = await import('react');
	return {
		TipTapComposer: react.forwardRef((_props, ref) => {
			react.useImperativeHandle(ref, () => ({
				getHTML: () => '',
				clear: () => {},
				runAction: () => {},
				isActionActive: () => false,
				setInsertionMarker: () => {}
			}));
			return <div contentEditable suppressContentEditableWarning />;
		})
	};
});

class Recorder {
	static current: Recorder;
	static isTypeSupported = () => true;
	state = 'inactive';
	mimeType = 'audio/webm';
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor() {
		Recorder.current = this;
	}
	start() {
		this.state = 'recording';
	}
	stop() {
		this.state = 'inactive';
		this.ondataavailable?.({
			data: new Blob(['recorded audio'], { type: this.mimeType })
		});
		this.onstop?.();
	}
}
const trackStop = vi.fn();
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
		messageDate: 1
	},
	consultant: {},
	user: { username: 'client', sessionData: {} }
};
function Composer(
	props: Partial<React.ComponentProps<typeof MessageSubmitInterfaceComponent>>
) {
	return (
		<MemoryRouter>
			<ActiveSessionContext.Provider
				value={
					{
						activeSession: session,
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

beforeEach(() => {
	vi.clearAllMocks();
	mocks.clearDraft.mockResolvedValue(undefined);
	vi.stubGlobal('MediaRecorder', Recorder);
	Object.assign(URL, {
		createObjectURL: vi.fn(() => 'blob:voice-preview'),
		revokeObjectURL: vi.fn()
	});
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		value: {
			getUserMedia: vi
				.fn()
				.mockResolvedValue({ getTracks: () => [{ stop: trackStop }] })
		}
	});
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

// #1142: Stop opens the review; the note only goes out on an explicit Send.
async function recordReviewAndSend() {
	await startRecording();
	await stopRecording();
	expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	await act(async () => {
		fireEvent.click(
			screen.getByRole('button', {
				name: 'enquiry.write.input.button.title'
			})
		);
	});
	await waitFor(() =>
		expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledOnce()
	);
	expect(trackStop).toHaveBeenCalledOnce();
	expect(
		vi.mocked(apiSendMatrixAttachmentMessage).mock.calls[0][1]
	).toMatchObject({ type: 'audio/webm' });
}

describe('recorded feedback review-and-send', () => {
	it('keeps the owner feedback intent on the actual recorded attachment send', async () => {
		render(
			<Composer feedbackMailIntent targetRoomId="!feedback:example.org" />
		);
		await recordReviewAndSend();
		expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledWith(
			'!feedback:example.org',
			expect.any(File),
			expect.objectContaining({
				feedbackMailIntent: true,
				supervisorMessage: false
			})
		);
	});
	it('keeps supervisor feedback in the protected room with its reminder intent', async () => {
		render(
			<Composer isSupervisor supervisionRoomId="!feedback:example.org" />
		);
		await recordReviewAndSend();
		expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledWith(
			'!feedback:example.org',
			expect.any(File),
			expect.objectContaining({
				feedbackMailIntent: true,
				supervisorMessage: true
			})
		);
	});
	it('keeps ordinary voice notes out of the feedback classifier', async () => {
		render(<Composer />);
		await recordReviewAndSend();
		expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledWith(
			'!case:example.org',
			expect.any(File),
			expect.objectContaining({
				feedbackMailIntent: false,
				supervisorMessage: false
			})
		);
	});
	it('keeps a team-room voice note out of the feedback classifier even with a stale feedback flag', async () => {
		render(
			<Composer
				feedbackMailIntent
				teamDiscussion
				targetRoomId="!team:example.org"
			/>
		);
		await recordReviewAndSend();
		expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledWith(
			'!team:example.org',
			expect.any(File),
			expect.objectContaining({
				feedbackMailIntent: false,
				teamDiscussion: true
			})
		);
	});
	it('uses the current feedback composer after props change before recording starts', async () => {
		const view = render(<Composer targetRoomId="!feedback:example.org" />);
		view.rerender(
			<Composer feedbackMailIntent targetRoomId="!feedback:example.org" />
		);
		await recordReviewAndSend();
		expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledWith(
			'!feedback:example.org',
			expect.any(File),
			expect.objectContaining({ feedbackMailIntent: true })
		);
	});
	it('keeps a recording tied to the feedback action that started it', async () => {
		const view = render(
			<Composer feedbackMailIntent targetRoomId="!feedback:example.org" />
		);
		await startRecording();
		view.rerender(<Composer targetRoomId="!feedback:example.org" />);
		await stopRecording();
		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', {
					name: 'enquiry.write.input.button.title'
				})
			);
		});
		await waitFor(() =>
			expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledOnce()
		);
		expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledWith(
			'!feedback:example.org',
			expect.any(File),
			expect.objectContaining({ feedbackMailIntent: true })
		);
	});
	it.each([false, true])(
		'preserves the original %s intent when retrying a failed text send from a changed composer',
		async (originalIntent) => {
			const onSendError = vi.fn();
			vi.mocked(apiSendMessage).mockRejectedValueOnce(
				new Error('send failed')
			);
			render(
				<Composer
					feedbackMailIntent={!originalIntent}
					onSendError={onSendError}
					retryRequest={{
						requestId: 'retry-voice-guard',
						failedSendId: 'original-failure',
						message: 'original message',
						transportMessage: 'original message',
						isAside: false,
						mentionedUserIds: [],
						targetRoomId: '!case:example.org',
						feedbackMailIntent: originalIntent
					}}
				/>
			);
			await waitFor(() => expect(apiSendMessage).toHaveBeenCalledOnce());
			expect(vi.mocked(apiSendMessage).mock.calls[0][13]).toBe(
				originalIntent
			);
			await waitFor(() => expect(onSendError).toHaveBeenCalledOnce());
			expect(onSendError.mock.calls[0][9]).toBe(originalIntent);
		}
	);
});

const MIC = { name: 'message.submit.toolbar.voiceRecording.label' };
const SEND = { name: 'enquiry.write.input.button.title' };

async function startRecording() {
	fireEvent.click(screen.getByRole('button', MIC));
	await waitFor(() => expect(Recorder.current?.state).toBe('recording'));
}

async function stopRecording() {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name: 'app.stop' }));
	});
}

describe('voice note review before sending (#1142)', () => {
	beforeEach(() => {
		Recorder.current = undefined as unknown as Recorder;
	});

	it('does not send when the recording is stopped, it opens a review with playback, discard and send', async () => {
		render(<Composer />);
		await startRecording();
		await stopRecording();

		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
		expect(trackStop).toHaveBeenCalledOnce();
		expect(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'voice.recording.discard' })
		).toBeTruthy();
		expect(
			(screen.getByRole('button', SEND) as HTMLButtonElement).disabled
		).toBe(false);
	});

	it('sends the reviewed recording only when send is pressed', async () => {
		render(<Composer />);
		await startRecording();
		await stopRecording();
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
		await act(async () => {
			fireEvent.click(screen.getByRole('button', SEND));
		});

		await waitFor(() =>
			expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledOnce()
		);
		expect(
			vi.mocked(apiSendMatrixAttachmentMessage).mock.calls[0][1]
		).toMatchObject({ type: 'audio/webm' });
	});

	it('discards the reviewed recording without sending and allows a new recording', async () => {
		render(<Composer />);
		await startRecording();
		await stopRecording();
		fireEvent.click(
			screen.getByRole('button', { name: 'voice.recording.discard' })
		);

		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
		expect(
			screen.queryByRole('button', { name: 'voicePlayer.play' })
		).toBeNull();
		expect(
			(screen.getByRole('button', SEND) as HTMLButtonElement).disabled
		).toBe(true);
		await startRecording();
		expect(Recorder.current.state).toBe('recording');
	});

	it('stops into the review instead of sending when the form is submitted mid-recording', async () => {
		render(<Composer />);
		await startRecording();
		await act(async () =>
			fireEvent.submit(screen.getByRole('button', SEND).closest('form')!)
		);

		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
		expect(
			await screen.findByRole('button', { name: 'voicePlayer.play' })
		).toBeTruthy();
	});

	it('cancel while recording drops the take without sending or opening a review', async () => {
		render(<Composer />);
		await startRecording();
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'app.cancel' }));
		});

		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
		expect(
			screen.queryByRole('button', { name: 'voicePlayer.play' })
		).toBeNull();
	});
});

it('keeps voice-only draft loading disabled until the outgoing clear settles', async () => {
	let settleClear: () => void;
	mocks.clearDraft.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				settleClear = resolve;
			})
	);
	render(<Composer />);
	await recordReviewAndSend();
	await waitFor(() => expect(mocks.clearDraft).toHaveBeenCalledOnce());
	expect(mocks.draftEnabled.mock.calls.at(-1)?.[0]).toBe(false);
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 1350));
	});
	expect(mocks.draftEnabled.mock.calls.at(-1)?.[0]).toBe(false);
	await act(async () => {
		settleClear!();
	});
	await waitFor(() =>
		expect(mocks.draftEnabled.mock.calls.at(-1)?.[0]).toBe(true)
	);
});
