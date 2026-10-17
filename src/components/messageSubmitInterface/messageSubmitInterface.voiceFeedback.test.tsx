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
	composerClear: vi.fn(),
	typeDraft: (_text: string) => {},
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
		TipTapComposer: react.forwardRef((props: any, ref) => {
			const valueRef = react.useRef('');
			valueRef.current = props.value ?? '';
			mocks.typeDraft = props.onChange;
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
					contentEditable
					suppressContentEditableWarning
					data-testid="composer-draft"
				>
					{props.value}
				</div>
			);
		})
	};
});

class Recorder {
	static current: Recorder;
	static isTypeSupported = () => true;
	state = 'inactive';
	static nextMimeType = 'audio/webm';
	// A real MediaRecorder fires `stop` in a later task, after `stop()` has
	// already made the state inactive.
	static deferStop = false;
	pendingStop: (() => void) | null = null;
	mimeType = Recorder.nextMimeType;
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
		if (Recorder.deferStop) {
			this.pendingStop = () => this.onstop?.();
			return;
		}
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
function Composer({
	sessionId,
	role = 'counsellor',
	...props
}: Partial<React.ComponentProps<typeof MessageSubmitInterfaceComponent>> & {
	sessionId?: number;
	role?: 'counsellor' | 'asker';
}) {
	const activeSession = sessionId
		? { ...session, item: { ...session.item, id: sessionId } }
		: session;
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
								userId: role,
								grantedAuthorities:
									role === 'asker'
										? ['ASKER']
										: ['CONSULTANT'],
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
	Recorder.nextMimeType = 'audio/webm';
	Recorder.deferStop = false;
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

	it('drops a reviewed take when the composer is reused for another chat', async () => {
		const view = render(<Composer sessionId={360} />);
		await startRecording();
		await stopRecording();
		expect(
			screen.getByRole('button', { name: 'voice.recording.discard' })
		).toBeTruthy();

		view.rerender(<Composer sessionId={361} />);

		await waitFor(() =>
			expect(
				screen.queryByRole('button', { name: 'voicePlayer.play' })
			).toBeNull()
		);
		expect(
			(screen.getByRole('button', SEND) as HTMLButtonElement).disabled
		).toBe(true);
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	});

	it('drops a running take when the composer is reused for another chat', async () => {
		const view = render(<Composer sessionId={360} />);
		await startRecording();

		view.rerender(<Composer sessionId={361} />);
		await waitFor(() => expect(trackStop).toHaveBeenCalled());

		expect(
			screen.queryByRole('button', { name: 'voicePlayer.play' })
		).toBeNull();
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	});

	it('keeps the filename card for a chosen audio file instead of the recording review', async () => {
		const { container } = render(<Composer />);
		const input = container.querySelector(
			'input[type="file"]'
		) as HTMLInputElement;
		const file = new File(['mp3'], 'interview.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(input, 'files', {
			configurable: true,
			value: [file]
		});
		await act(async () => {
			fireEvent.change(input);
		});

		expect(await screen.findByText('interview.mp3')).toBeTruthy();
		expect(
			screen.queryByRole('group', { name: 'voice.recording.preview' })
		).toBeNull();
	});

	it('keeps a typed draft in the composer when the review opens, and after discard', async () => {
		render(<Composer />);
		act(() => mocks.typeDraft('Please call me back tomorrow'));
		await startRecording();
		await stopRecording();

		expect(mocks.composerClear).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole('button', { name: 'voice.recording.discard' })
		);
		expect(mocks.composerClear).not.toHaveBeenCalled();
		expect(screen.getByTestId('composer-draft').textContent).toBe(
			'Please call me back tomorrow'
		);
	});

	it('sends only the voice note and leaves the typed draft in the composer', async () => {
		render(<Composer />);
		act(() => mocks.typeDraft('Please call me back tomorrow'));
		await startRecording();
		await stopRecording();
		await act(async () => {
			fireEvent.click(screen.getByRole('button', SEND));
		});

		await waitFor(() =>
			expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledOnce()
		);
		expect(apiSendMessage).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(
				screen.queryByRole('button', { name: 'voicePlayer.play' })
			).toBeNull()
		);
		expect(mocks.composerClear).not.toHaveBeenCalled();
		expect(screen.getByTestId('composer-draft').textContent).toBe(
			'Please call me back tomorrow'
		);
	});

	it('lets an advice seeker record, review and send a voice note', async () => {
		render(<Composer role="asker" />);
		await startRecording();
		await stopRecording();
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
		expect(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		).toBeTruthy();
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

	it('ends the 180 s auto-stop in the review without sending', async () => {
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		try {
			render(<Composer />);
			fireEvent.click(screen.getByRole('button', MIC));
			await act(async () => {});
			expect(Recorder.current.state).toBe('recording');

			await act(async () => {
				vi.advanceTimersByTime(180_000);
			});

			expect(Recorder.current.state).toBe('inactive');
			expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
			expect(
				screen.getByRole('button', { name: 'voicePlayer.play' })
			).toBeTruthy();
			expect(
				screen.getByRole('button', { name: 'voice.recording.discard' })
			).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});

	it('names an audio/mp4 take (iOS Safari) .m4a so it stays a recognisable voice note', async () => {
		Recorder.nextMimeType = 'audio/mp4';
		render(<Composer />);
		await startRecording();
		await stopRecording();
		await act(async () => {
			fireEvent.click(screen.getByRole('button', SEND));
		});

		await waitFor(() =>
			expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledOnce()
		);
		const sent = vi.mocked(apiSendMatrixAttachmentMessage).mock
			.calls[0][1] as File;
		expect(sent.type).toBe('audio/mp4');
		expect(sent.name).toMatch(/^voice-message-\d+-s\d+-ms\d+\.m4a$/);
	});

	it('keeps Cancel pressed between Stop and the recorder stop event a discard', async () => {
		Recorder.deferStop = true;
		render(<Composer />);
		await startRecording();
		await stopRecording();
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'app.cancel' }));
		});
		await act(async () => {
			Recorder.current.pendingStop?.();
		});

		expect(
			screen.queryByRole('button', { name: 'voicePlayer.play' })
		).toBeNull();
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	});

	it('drops a thread-A take when the same composer is reused for thread B', async () => {
		const view = render(<Composer threadRootId="$threadA" />);
		await startRecording();
		await stopRecording();
		expect(
			screen.getByRole('button', { name: 'voice.recording.discard' })
		).toBeTruthy();

		view.rerender(<Composer threadRootId="$threadB" />);

		await waitFor(() =>
			expect(
				screen.queryByRole('button', { name: 'voicePlayer.play' })
			).toBeNull()
		);
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	});

	it('drops a take recorded before the supervision route resolved', async () => {
		const view = render(<Composer />);
		await startRecording();
		await stopRecording();
		expect(
			screen.getByRole('button', { name: 'voice.recording.discard' })
		).toBeTruthy();

		// SessionItemComponent resolves the supervisor route asynchronously.
		view.rerender(
			<Composer isSupervisor supervisionRoomId="!feedback:example.org" />
		);

		await waitFor(() =>
			expect(
				screen.queryByRole('button', { name: 'voicePlayer.play' })
			).toBeNull()
		);
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	});

	it('drops a supervisor take when the supervision room resolves to another room', async () => {
		const view = render(
			<Composer isSupervisor supervisionRoomId="!old:example.org" />
		);
		await startRecording();
		await stopRecording();

		view.rerender(
			<Composer isSupervisor supervisionRoomId="!new:example.org" />
		);

		await waitFor(() =>
			expect(
				screen.queryByRole('button', { name: 'voicePlayer.play' })
			).toBeNull()
		);
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	});

	it('keeps a client-room take when only the unused supervision room resolves', async () => {
		const view = render(<Composer />);
		await startRecording();
		await stopRecording();

		view.rerender(<Composer supervisionRoomId="!feedback:example.org" />);

		await act(async () => {});
		expect(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		).toBeTruthy();
		await act(async () => {
			fireEvent.click(screen.getByRole('button', SEND));
		});
		await waitFor(() =>
			expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledOnce()
		);
	});

	it('keeps a staged take when an unrelated text retry succeeds', async () => {
		const view = render(<Composer />);
		await startRecording();
		await stopRecording();
		expect(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		).toBeTruthy();

		view.rerender(
			<Composer
				retryRequest={{
					requestId: 'retry-while-reviewing',
					failedSendId: 'original-failure',
					message: 'original message',
					transportMessage: 'original message',
					isAside: false,
					mentionedUserIds: [],
					targetRoomId: '!case:example.org',
					feedbackMailIntent: false
				}}
			/>
		);
		await waitFor(() => expect(apiSendMessage).toHaveBeenCalledOnce());
		await act(async () => {});

		expect(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		).toBeTruthy();
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	});

	it('does not start a recorder when the composer unmounts while the microphone permission is pending', async () => {
		let grant: (stream: unknown) => void = () => {};
		vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValueOnce(
			new Promise((resolve) => {
				grant = resolve;
			}) as Promise<MediaStream>
		);
		const view = render(<Composer />);
		fireEvent.click(screen.getByRole('button', MIC));
		view.unmount();

		await act(async () => {
			grant({ getTracks: () => [{ stop: trackStop }] });
		});

		expect(Recorder.current).toBeUndefined();
		expect(trackStop).toHaveBeenCalledOnce();
	});

	it('creates no preview URL when the recorder stops after the composer unmounted', async () => {
		Recorder.deferStop = true;
		const view = render(<Composer />);
		await startRecording();
		await stopRecording();
		view.unmount();

		await act(async () => {
			Recorder.current.pendingStop?.();
		});

		expect(URL.createObjectURL).not.toHaveBeenCalled();
	});

	it('revokes the preview URL when the composer unmounts during the review', async () => {
		const view = render(<Composer />);
		await startRecording();
		await stopRecording();
		expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(
			'blob:voice-preview'
		);

		view.unmount();

		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:voice-preview');
	});

	it('drops a recording whose microphone permission resolves after the chat changed', async () => {
		let grantMicrophone: (stream: unknown) => void = () => {};
		vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValueOnce(
			new Promise((resolve) => {
				grantMicrophone = resolve;
			}) as Promise<MediaStream>
		);
		const view = render(<Composer sessionId={360} />);
		fireEvent.click(screen.getByRole('button', MIC));

		view.rerender(<Composer sessionId={361} />);
		await act(async () => {
			grantMicrophone({ getTracks: () => [{ stop: trackStop }] });
		});

		await waitFor(() => expect(trackStop).toHaveBeenCalled());
		expect(Recorder.current).toBeUndefined();
		expect(screen.queryByRole('button', { name: 'app.stop' })).toBeNull();
	});

	it('still sends a reviewed voice note when the preserved draft is over the length limit', async () => {
		render(<Composer />);
		act(() => mocks.typeDraft('x'.repeat(7501)));
		await startRecording();
		await stopRecording();

		expect(
			(screen.getByRole('button', SEND) as HTMLButtonElement).disabled
		).toBe(false);
		await act(async () => {
			fireEvent.click(screen.getByRole('button', SEND));
		});

		await waitFor(() =>
			expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledOnce()
		);
		expect(apiSendMessage).not.toHaveBeenCalled();
	});

	it('shows the microphone disabled with a reason while a message is being edited, and a click records nothing', async () => {
		render(
			<Composer editingMessage={{ eventId: '$e1', text: 'old text' }} />
		);

		const mic = screen.getByRole('button', MIC);
		const reason =
			'message.submit.toolbar.voiceRecording.disabledWhileEditing';
		expect(mic.getAttribute('aria-disabled')).toBe('true');
		// Still focusable (aria-disabled, not `disabled`) so keyboard and
		// screen-reader users reach the explanation.
		expect((mic as HTMLButtonElement).disabled).toBe(false);
		expect(mic.getAttribute('title')).toBe(reason);
		expect(
			document.getElementById(
				mic.getAttribute('aria-describedby') ?? 'missing'
			)?.textContent
		).toBe(reason);

		Recorder.current = undefined as unknown as Recorder;
		await act(async () => {
			fireEvent.click(mic);
		});
		expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
		expect(Recorder.current).toBeUndefined();
		expect(screen.queryByRole('button', { name: 'app.stop' })).toBeNull();
	});

	it('keeps the microphone enabled and unexplained when no message is being edited', () => {
		render(<Composer />);

		const mic = screen.getByRole('button', MIC);
		expect(mic.getAttribute('aria-disabled')).toBeNull();
		expect(mic.getAttribute('aria-describedby')).toBeNull();
	});

	it('drops a running take when a message edit starts', async () => {
		const view = render(<Composer />);
		await startRecording();

		view.rerender(
			<Composer editingMessage={{ eventId: '$e1', text: 'old text' }} />
		);

		await waitFor(() => expect(trackStop).toHaveBeenCalled());
		expect(screen.queryByRole('button', { name: 'app.stop' })).toBeNull();
		expect(apiSendMatrixAttachmentMessage).not.toHaveBeenCalled();
	});

	it('drops the staged recording when another file is selected, so Send sends what is shown', async () => {
		render(<Composer />);
		await startRecording();
		await stopRecording();
		expect(
			screen.getByRole('button', { name: 'voicePlayer.play' })
		).toBeTruthy();

		const other = new File(['other audio'], 'other-take.webm', {
			type: 'audio/webm'
		});
		const input = document.getElementById('dataUpload') as HTMLInputElement;
		Object.defineProperty(input, 'files', {
			configurable: true,
			value: [other]
		});
		await act(async () => {
			fireEvent.change(input);
		});

		// The old take is no longer previewed and its URL is released.
		expect(
			screen.queryByRole('button', { name: 'voicePlayer.play' })
		).toBeNull();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:voice-preview');
		expect(screen.getByText('other-take.webm')).toBeTruthy();

		await act(async () => {
			fireEvent.click(screen.getByRole('button', SEND));
		});
		await waitFor(() =>
			expect(apiSendMatrixAttachmentMessage).toHaveBeenCalledOnce()
		);
		expect(vi.mocked(apiSendMatrixAttachmentMessage).mock.calls[0][1]).toBe(
			other
		);
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
