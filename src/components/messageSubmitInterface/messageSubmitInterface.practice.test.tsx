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
import { enterPracticeMode, exitPracticeMode } from '../../practice';

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
		TipTapComposer: react.forwardRef(
			(
				props: { value: string; onChange: (text: string) => void },
				ref
			) => {
				react.useImperativeHandle(ref, () => ({
					getHTML: () => props.value,
					clear: () => {},
					runAction: () => {},
					isActionActive: () => false,
					setInsertionMarker: () => {}
				}));
				return (
					<textarea
						aria-label="Test composer"
						value={props.value}
						onChange={(event) => props.onChange(event.target.value)}
					/>
				);
			}
		)
	};
});

const session = {
	rid: null,
	isGroup: false,
	isSession: true,
	item: {
		id: -2,
		agencyId: -1,
		matrixRoomId: '!practice-2:practice.invalid',
		status: 'ACTIVE',
		registrationType: 'REGISTERED',
		messageDate: 1
	},
	consultant: {},
	user: { username: 'client', sessionData: {} }
};

const Composer = () => (
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
						/>
					</E2EEContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</ActiveSessionContext.Provider>
	</MemoryRouter>
);

const VOICE = { name: 'message.submit.toolbar.voiceRecording.label' };
const ATTACHMENT = { name: 'message.submit.toolbar.attachment' };

beforeEach(() => {
	vi.clearAllMocks();
	mocks.clearDraft.mockResolvedValue(undefined);
});
afterEach(() => {
	cleanup();
	exitPracticeMode();
	vi.useRealTimers();
});

describe('composer media controls and practice mode (no voice, no attachments)', () => {
	it('offers voice recording, attachments and the file input outside practice', () => {
		const { container } = render(<Composer />);

		expect(screen.getByRole('button', VOICE)).toBeTruthy();
		expect(screen.getByRole('button', ATTACHMENT)).toBeTruthy();
		expect(container.querySelector('input[type="file"]')).not.toBeNull();
	});

	it('offers none of them while practising', () => {
		enterPracticeMode({ tourId: 'consultant-practice-accept' });

		const { container } = render(<Composer />);

		expect(screen.queryByRole('button', VOICE)).toBeNull();
		expect(screen.queryByRole('button', ATTACHMENT)).toBeNull();
		expect(container.querySelector('input[type="file"]')).toBeNull();
	});

	it('drops them when practice starts under an already mounted composer', () => {
		const { container } = render(<Composer />);
		expect(screen.getByRole('button', VOICE)).toBeTruthy();

		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));

		expect(screen.queryByRole('button', VOICE)).toBeNull();
		expect(container.querySelector('input[type="file"]')).toBeNull();
	});
});

it.each([false, true])(
	'keeps draft loading disabled until sent draft clear settles (failure=%s)',
	async (fails) => {
		let settleClear: () => void;
		mocks.clearDraft.mockImplementation(
			() =>
				new Promise<void>((resolve, reject) => {
					settleClear = () =>
						fails
							? reject(new Error('Draft unavailable'))
							: resolve();
				})
		);
		render(<Composer />);
		fireEvent.change(screen.getByLabelText('Test composer'), {
			target: { value: '<p>Sent reply</p>' }
		});
		await act(async () => {
			fireEvent.submit(
				screen
					.getByRole('button', {
						name: 'enquiry.write.input.button.title'
					})
					.closest('form')!
			);
		});
		await waitFor(() => expect(mocks.clearDraft).toHaveBeenCalledOnce());
		expect(mocks.draftEnabled.mock.calls.at(-1)?.[0]).toBe(false);
		// The editor stays editable: typing the next reply must survive clear settlement.
		fireEvent.change(screen.getByLabelText('Test composer'), {
			target: { value: '<p>Next unsent reply</p>' }
		});
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
		expect(
			(screen.getByLabelText('Test composer') as HTMLTextAreaElement)
				.value
		).toBe('<p>Next unsent reply</p>');
	}
);
