// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import type { TenantDataInterface } from '../../globalState/interfaces/TenantDataInterface';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { CaseHandoverConversation } from './CaseHandoverConversation';

vi.hoisted(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		fillRect() {}
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('lottie-web', () => ({
	default: {
		loadAnimation: () => ({
			destroy() {},
			addEventListener() {},
			play() {},
			stop() {}
		})
	}
}));
vi.mock('focus-trap-react', () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: unknown) =>
			typeof fallback === 'string' ? fallback : key
	})
}));

const DISMISS = 'caseHandover.systemMessage.dismiss';
const CARD_TESTID = 'case-handover-inline-consent';
const approve = vi.fn();
const decline = vi.fn();

type ConversationProps = React.ComponentProps<typeof CaseHandoverConversation>;

/**
 * The real conversation continuation with its real providers — the same path
 * `SessionStream` mounts for an advice seeker. Nothing about the card or the
 * dismissal is mocked.
 */
const mount = (props: Partial<ConversationProps> = {}) =>
	render(
		<UserDataContext.Provider
			value={{
				userData: { userId: 'asker-1' } as UserDataInterface,
				reloadUserData: async () =>
					({ userId: 'asker-1' }) as UserDataInterface,
				setUserData: () => {}
			}}
		>
			<TenantContext.Provider
				value={{
					tenant: { settings: {} } as TenantDataInterface,
					setTenant: () => {},
					updateTenantSettings: () => {}
				}}
			>
				<ModalProvider>
					<div className="session__content">
						<CaseHandoverConversation
							dismissKey="notification-1"
							onApprove={approve}
							onDecline={decline}
							{...props}
						/>
					</div>
					<div
						className="messageSubmit__wrapper"
						data-testid="composer"
					>
						<div contentEditable suppressContentEditableWarning />
					</div>
				</ModalProvider>
			</TenantContext.Provider>
		</UserDataContext.Provider>
	);

beforeEach(() => {
	approve.mockClear();
	decline.mockClear();
	localStorage.clear();
	document.body.innerHTML = '<div id="overlay"></div>';
});
afterEach(cleanup);

describe('dismissing the case-handover system message (ORISO-Frontend#1700)', () => {
	it('offers a close control on the information-only notice and hides it on click', () => {
		mount({ mode: 'NONE' });
		expect(screen.getByTestId(CARD_TESTID)).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: DISMISS }));

		expect(screen.queryByTestId(CARD_TESTID)).toBeNull();
		// Dismissing is not a decision: it must never answer the request.
		expect(approve).not.toHaveBeenCalled();
		expect(decline).not.toHaveBeenCalled();
	});

	it('keeps an information-only notice dismissed after a reload', () => {
		const first = mount({ mode: 'NONE' });
		fireEvent.click(screen.getByRole('button', { name: DISMISS }));
		first.unmount();

		mount({ mode: 'NONE' });
		expect(screen.queryByTestId(CARD_TESTID)).toBeNull();
	});

	it('keeps a settled request dismissed after a reload', () => {
		const first = mount({ mode: 'OPT_IN', status: 'GRANTED' });
		fireEvent.click(screen.getByRole('button', { name: DISMISS }));
		first.unmount();

		mount({ mode: 'OPT_IN', status: 'GRANTED' });
		expect(screen.queryByTestId(CARD_TESTID)).toBeNull();
	});

	it('hides a still-open request for now but brings it back on reload, so the decision is never lost', () => {
		const first = mount({ mode: 'OPT_IN' });
		fireEvent.click(screen.getByRole('button', { name: DISMISS }));
		expect(screen.queryByTestId(CARD_TESTID)).toBeNull();
		expect(approve).not.toHaveBeenCalled();
		expect(decline).not.toHaveBeenCalled();
		first.unmount();

		mount({ mode: 'OPT_IN' });
		expect(screen.getByTestId(CARD_TESTID)).toBeTruthy();
	});

	it('dismisses with Escape from inside the notice and hands focus to the composer', async () => {
		mount({ mode: 'NONE' });
		const close = screen.getByRole('button', { name: DISMISS });
		close.focus();

		fireEvent.keyDown(close, { key: 'Escape' });

		expect(screen.queryByTestId(CARD_TESTID)).toBeNull();
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen
					.getByTestId('composer')
					.querySelector('[contenteditable]')
			)
		);
	});

	it('does not dismiss a different notification', () => {
		const first = mount({ mode: 'NONE', dismissKey: 'notification-1' });
		fireEvent.click(screen.getByRole('button', { name: DISMISS }));
		first.unmount();

		mount({ mode: 'NONE', dismissKey: 'notification-2' });
		expect(screen.getByTestId(CARD_TESTID)).toBeTruthy();
	});
});
