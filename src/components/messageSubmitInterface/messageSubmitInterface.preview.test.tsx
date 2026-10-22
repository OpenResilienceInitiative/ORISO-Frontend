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
import * as api from '../../api';
import { STATUS_ARCHIVED } from '../../globalState/interfaces/SessionsDataInterface';

const mocks = vi.hoisted(() => ({
	clearDraft: vi.fn().mockResolvedValue(undefined),
	draftChange: vi.fn(),
	draftEnabled: vi.fn(),
	draftOptions: vi.fn(),
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
	useDraftMessage: (enabled: boolean, _load: unknown, options: unknown) => {
		mocks.draftEnabled(enabled);
		mocks.draftOptions(options);
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

const session = (status: number | string) => ({
	rid: '!room:x',
	isGroup: false,
	isSession: true,
	item: {
		id: 13,
		agencyId: 1,
		matrixRoomId: '!room:x',
		status,
		registrationType: 'REGISTERED',
		messageDate: 1
	},
	consultant: { id: 'counsellor' },
	user: { username: 'client', sessionData: {} }
});

const Composer = ({
	status = 2,
	...props
}: Partial<React.ComponentProps<typeof MessageSubmitInterfaceComponent>> & {
	status?: number | string;
}) => (
	<MemoryRouter initialEntries={['/notifications']}>
		<ActiveSessionContext.Provider
			value={
				{
					activeSession: session(status),
					reloadActiveSession: () => undefined
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

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const submit = async (text: string) => {
	fireEvent.change(screen.getByLabelText('Test composer'), {
		target: { value: text }
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
};

describe('composer outside its conversation (#1824: Activity Timeline preview)', () => {
	it('keeps the draft under the conversation’s path, not the page it is shown on', () => {
		render(
			<Composer draftActionPath="/sessions/consultant/sessionView/!room:x/13" />
		);
		expect(mocks.draftOptions).toHaveBeenLastCalledWith(
			expect.objectContaining({
				actionPath: '/sessions/consultant/sessionView/!room:x/13'
			})
		);
	});

	it('without an override, the draft path follows the current route (unchanged)', () => {
		render(<Composer />);
		expect(mocks.draftOptions).toHaveBeenLastCalledWith(
			expect.objectContaining({ actionPath: '/notifications' })
		);
	});

	it('never re-opens an archived conversation when dearchiving is not allowed', async () => {
		render(<Composer status={STATUS_ARCHIVED} allowDearchive={false} />);
		await submit('<p>Hallo</p>');
		expect(api.apiPutDearchive).not.toHaveBeenCalled();
		expect(mocks.clearDraft).not.toHaveBeenCalled();
	});

	it('still re-opens it inside the conversation (unchanged)', async () => {
		render(<Composer status={STATUS_ARCHIVED} />);
		await submit('<p>Hallo</p>');
		await waitFor(() =>
			expect(api.apiPutDearchive).toHaveBeenCalledWith(13)
		);
	});
});
