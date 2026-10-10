// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render as renderUI,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { mockUserData } from '../message/MessageItemComponent.mocks';
import { StandingAccessSettings } from './StandingAccessSettings';
vi.hoisted(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		fillRect() {}
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
const render = (ui: React.ReactElement) =>
	renderUI(ui, {
		wrapper: ({ children }) => (
			<UserDataContext.Provider
				value={{
					userData: mockUserData(),
					reloadUserData: async () => mockUserData(),
					setUserData: () => {}
				}}
			>
				{children}
			</UserDataContext.Provider>
		)
	});
const { get, put, channels, tenant } = vi.hoisted(() => ({
	get: vi.fn(),
	put: vi.fn(),
	channels: vi.fn(),
	tenant: vi.fn()
}));
vi.mock('../../api/apiCaseHandover', () => ({
	apiGetCaseHandoverConsentPreference: get,
	apiSaveCaseHandoverConsentPreference: put
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../globalState/provider/TenantProvider', () => ({
	useTenant: tenant
}));
vi.mock('../erstantwort/useNotificationChannels', () => ({
	useNotificationChannels: channels
}));
// Channel setup has its own public flow tests; observe its invocation here.
vi.mock('../erstantwort/NotificationSetup', () => ({
	NotificationSetup: ({ onStart }: { onStart?: () => void }) => (
		<button onClick={onStart}>Notification setup</button>
	)
}));
vi.mock('../erstantwort/ErstantwortSequence', () => ({
	ErstantwortSequence: ({
		slots
	}: {
		slots: Record<string, React.ReactNode>;
	}) => (
		<>
			{Object.entries(slots).map(([key, child]) => (
				<React.Fragment key={key}>{child}</React.Fragment>
			))}
		</>
	)
}));
vi.mock('focus-trap-react', () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
const preference = (
	alwaysAskBeforeAdditionalAccess = false,
	sessionId = 1
) => ({ sessionId, alwaysAskBeforeAdditionalAccess });
const open = () =>
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.consent.info.title' })
	);
beforeEach(() => {
	get.mockReset().mockResolvedValue(preference());
	put.mockReset().mockImplementation(async (_id, value) => preference(value));
	channels.mockReturnValue({
		consentEmailActive: false,
		browserActive: true
	});
	tenant.mockReturnValue({ settings: {} });
	document.body.innerHTML = '<div id="overlay"></div>';
});
afterEach(cleanup);
it('reads the live preference on opening and never fabricates an unchecked initial control', async () => {
	let resolve!: (value: ReturnType<typeof preference>) => void;
	get.mockImplementationOnce(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	render(
		<StandingAccessSettings sessionId={1} conversationType="ASYNCHRONOUS" />
	);
	open();
	expect(screen.queryByRole('switch')).toBeNull();
	await act(async () => resolve(preference(true)));
	expect(screen.getByRole('switch').matches(':checked')).toBe(true);
	expect(put).not.toHaveBeenCalled();
	expect(screen.queryByText('Notification setup')).toBeNull();
});
it('offers the optional email setup only after a confirmed stricter preference despite active browser', async () => {
	get.mockResolvedValueOnce(preference()).mockResolvedValueOnce(
		preference(true)
	);
	render(<StandingAccessSettings sessionId={1} />);
	open();
	fireEvent.click(await screen.findByRole('switch'));
	await screen.findByText('Notification setup');
	expect(put).toHaveBeenCalledWith(1, true);
	expect(get).toHaveBeenCalledTimes(2);
});
it('keeps the original setting and shows failure if server readback rejects the change', async () => {
	render(<StandingAccessSettings sessionId={1} />);
	open();
	fireEvent.click(await screen.findByRole('switch'));
	await screen.findByRole('alert');
	expect(screen.getByRole('switch').matches(':checked')).toBe(false);
	expect(screen.queryByText('Notification setup')).toBeNull();
});
it('does not offer setup when email consent notifications are already active', async () => {
	channels.mockReturnValue({ consentEmailActive: true, browserActive: true });
	get.mockResolvedValueOnce(preference()).mockResolvedValueOnce(
		preference(true)
	);
	render(<StandingAccessSettings sessionId={1} />);
	open();
	fireEvent.click(await screen.findByRole('switch'));
	await act(async () => {});
	expect(screen.queryByText('Notification setup')).toBeNull();
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('does not recommend notification setup on a confirmed change back to agency baseline', async () => {
	get.mockResolvedValueOnce(preference(true)).mockResolvedValueOnce(
		preference()
	);
	render(<StandingAccessSettings sessionId={1} />);
	open();
	fireEvent.click(await screen.findByRole('switch'));
	await act(async () => {});
	expect(put).toHaveBeenCalledWith(1, false);
	expect(screen.queryByText('Notification setup')).toBeNull();
});
it('rejects a response from a different conversation without exposing a setting', async () => {
	get.mockResolvedValue(preference(true, 2));
	render(<StandingAccessSettings sessionId={1} />);
	open();
	await screen.findByRole('alert');
	expect(screen.queryByRole('switch')).toBeNull();
});
it('never recommends email for a live-chat conversation whose email channel is disabled', async () => {
	get.mockResolvedValueOnce(preference()).mockResolvedValueOnce(
		preference(true)
	);
	render(
		<StandingAccessSettings sessionId={1} conversationType="LIVE_CHAT" />
	);
	open();
	fireEvent.click(await screen.findByRole('switch'));
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	expect(screen.queryByText('Notification setup')).toBeNull();
});
it('keeps failed loads retryable without issuing a save', async () => {
	get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(
		preference(true)
	);
	render(<StandingAccessSettings sessionId={1} />);
	open();
	await screen.findByRole('alert');
	expect(screen.queryByRole('switch')).toBeNull();
	fireEvent.click(
		screen.getByRole('button', { name: 'sessionList.reloadButton.label' })
	);
	expect((await screen.findByRole('switch')).matches(':checked')).toBe(true);
	expect(put).not.toHaveBeenCalled();
});
it('keeps a failed PUT from being shown as a successful preference', async () => {
	put.mockRejectedValueOnce(new Error('forbidden'));
	render(<StandingAccessSettings sessionId={1} />);
	open();
	fireEvent.click(await screen.findByRole('switch'));
	await screen.findByRole('alert');
	expect(screen.getByRole('switch').matches(':checked')).toBe(false);
	expect(get).toHaveBeenCalledTimes(1);
	expect(screen.queryByText('Notification setup')).toBeNull();
});
it('abandons old conversation readback when navigating to another conversation', async () => {
	let complete!: (value: ReturnType<typeof preference>) => void;
	get.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				complete = resolve;
			})
	);
	const view = render(<StandingAccessSettings sessionId={1} />);
	open();
	view.rerender(<StandingAccessSettings sessionId={2} />);
	await act(async () => complete(preference(true)));
	expect(screen.queryByRole('switch')).toBeNull();
	expect(screen.queryByText('Notification setup')).toBeNull();
	get.mockResolvedValueOnce(preference(false, 2));
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	await waitFor(() =>
		expect(
			screen.getByRole('button', {
				name: 'caseHandover.consent.info.title'
			})
		).toBeTruthy()
	);
	open();
	expect((await screen.findByRole('switch')).matches(':checked')).toBe(false);
});
it('preserves a started channel setup after email readback becomes active so BOTH can continue', async () => {
	get.mockResolvedValueOnce(preference()).mockResolvedValueOnce(
		preference(true)
	);
	const view = render(<StandingAccessSettings sessionId={1} />);
	open();
	fireEvent.click(await screen.findByRole('switch'));
	fireEvent.click(
		await screen.findByRole('button', { name: 'Notification setup' })
	);
	channels.mockReturnValue({
		consentEmailActive: true,
		browserActive: false
	});
	view.rerender(<StandingAccessSettings sessionId={1} />);
	expect(
		screen.getByRole('button', { name: 'Notification setup' })
	).toBeTruthy();
});
it('suppresses an unstarted recommendation if the allowed email channel is configured elsewhere', async () => {
	get.mockResolvedValueOnce(preference()).mockResolvedValueOnce(
		preference(true)
	);
	const view = render(<StandingAccessSettings sessionId={1} />);
	open();
	fireEvent.click(await screen.findByRole('switch'));
	await screen.findByText('Notification setup');
	channels.mockReturnValue({ consentEmailActive: true, browserActive: true });
	view.rerender(<StandingAccessSettings sessionId={1} />);
	expect(screen.queryByText('Notification setup')).toBeNull();
});

it('disables the compact action while its current preference load is pending', () => {
	get.mockImplementationOnce(() => new Promise(() => {}));
	render(<StandingAccessSettings sessionId={1} compact />);
	const action = screen.getByRole('button', {
		name: 'caseHandover.consent.info.more'
	});
	fireEvent.click(action);
	expect(action.matches(':disabled')).toBe(true);
});
it('ignores an old closed load after reopening and confirming a newer preference', async () => {
	let finishOld!: (value: ReturnType<typeof preference>) => void;
	get.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishOld = resolve;
			})
	)
		.mockResolvedValueOnce(preference())
		.mockResolvedValueOnce(preference(true))
		.mockResolvedValueOnce(preference(true));
	render(<StandingAccessSettings sessionId={1} compact />);
	const openCompact = () =>
		fireEvent.click(
			screen.getByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		);
	openCompact();
	fireEvent.click(screen.getAllByRole('button', { name: 'app.close' })[0]);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	openCompact();
	fireEvent.click(await screen.findByRole('switch'));
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	expect(put).toHaveBeenCalledWith(1, true);
	openCompact();
	expect((await screen.findByRole('switch')).matches(':checked')).toBe(true);
	await act(async () => finishOld(preference()));
	expect(screen.getByRole('switch').matches(':checked')).toBe(true);
});

it('returns focus to the exact compact opener after a loading dialog closes', async () => {
	get.mockImplementationOnce(() => new Promise(() => {}));
	render(<StandingAccessSettings sessionId={1} compact />);
	const opener = screen.getByRole('button', {
		name: 'caseHandover.consent.info.more'
	});
	fireEvent.click(opener);
	fireEvent.click(screen.getAllByRole('button', { name: 'app.close' })[0]);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	expect(document.activeElement).toBe(opener);
});
