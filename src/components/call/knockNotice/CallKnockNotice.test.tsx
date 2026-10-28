// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CallKnock } from './callKnockModel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values
				? `${key}(${Object.entries(values)
						.map(([name, value]) => `${name}=${value}`)
						.join(',')})`
				: key
	})
}));

const { CallKnockNoticeHost } = await import('./CallKnockNoticeHost');
const { createFakeCallKnockTransport } = await import(
	'./fakeCallKnockTransport'
);

afterEach(cleanup);

const names: Record<number, string> = { 1: 'anna-1', 2: 'ben-2' };

/** Everybody knocks on the current call (session 501) unless told otherwise. */
const knock = (
	id: number,
	sessionId = 501,
	displayName: string | null = names[id] ?? null
): CallKnock => ({
	id,
	sessionId,
	displayName,
	status: 'PENDING',
	medium: 'AUDIO',
	requestedAt: '2026-10-28T10:00:00Z'
});

const SCOPE = { sessionId: 501 } as const;

const setup = (
	knocks: CallKnock[],
	props: Partial<React.ComponentProps<typeof CallKnockNoticeHost>> = {}
) => {
	const transport = createFakeCallKnockTransport(knocks);
	const playSound = vi.fn();
	const view = render(
		<CallKnockNoticeHost
			transport={transport}
			scope={SCOPE}
			playSound={playSound}
			{...props}
		/>
	);
	return { transport, playSound, view };
};

describe('CallKnockNotice (#1892)', () => {
	it('shows nothing while nobody knocks', () => {
		const { playSound } = setup([]);
		expect(screen.queryByTestId('call-knock-notice')).toBeNull();
		expect(playSound).not.toHaveBeenCalled();
	});

	it('names the knocking person and lets them in with one click', async () => {
		const { transport } = setup([knock(1)]);
		expect(await screen.findByText('anna-1')).toBeTruthy();
		expect(
			screen.getByRole('region', { name: 'calls.knock.region' })
		).toBeTruthy();
		expect(screen.queryByTestId('call-knock-admit-all')).toBeNull();

		await userEvent.click(
			screen.getByRole('button', { name: 'calls.knock.admit' })
		);
		expect(transport.decisions).toEqual(['admit:1']);
		expect(screen.queryByTestId('call-knock-notice')).toBeNull();
	});

	it.each([null, '', '   '])(
		'falls back to "Eine Person" when the server sends the name %j',
		async (displayName) => {
			setup([knock(9, 501, displayName)]);
			expect(await screen.findByText('calls.knock.someone')).toBeTruthy();
		}
	);

	it('shows the name the server sends, without asking anywhere else', async () => {
		setup([knock(3, 501, 'chosen-name')]);
		expect(await screen.findByText('chosen-name')).toBeTruthy();
	});

	it('shows only knocks of the current call', async () => {
		setup([knock(1), knock(2, 777)]);
		expect(await screen.findByText('anna-1')).toBeTruthy();
		expect(screen.queryByText('ben-2')).toBeNull();
		expect(screen.queryByTestId('call-knock-position')).toBeNull();
	});

	it('"Alle einlassen" admits this call only, never another conversation', async () => {
		const { transport } = setup([knock(1), knock(2), knock(5, 777)]);
		await screen.findByText('anna-1');
		await userEvent.click(
			screen.getByRole('button', { name: 'calls.knock.admitAll' })
		);
		expect(transport.decisions).toEqual(['admit-all:sessionId=501']);
		expect(transport.pending().map((k) => k.id)).toEqual([5]);
		expect(screen.queryByTestId('call-knock-notice')).toBeNull();
	});

	it('asks nothing without a call to scope to', () => {
		const transport = createFakeCallKnockTransport([knock(1)]);
		const watchPending = vi.spyOn(transport, 'watchPending');
		render(
			<CallKnockNoticeHost
				scope={null}
				transport={transport}
				playSound={vi.fn()}
			/>
		);
		expect(watchPending).not.toHaveBeenCalled();
		expect(screen.queryByTestId('call-knock-notice')).toBeNull();
	});

	it('ties each decision to the person shown', async () => {
		setup([knock(1)]);
		await screen.findByText('anna-1');
		const admit = screen.getByRole('button', { name: 'calls.knock.admit' });
		const describedBy = (button: HTMLElement) =>
			document.getElementById(
				button.getAttribute('aria-describedby') ?? ''
			)?.textContent;
		expect(describedBy(admit)).toBe('anna-1');
		expect(
			describedBy(
				screen.getByRole('button', { name: 'calls.knock.decline' })
			)
		).toBe('anna-1');
	});

	it('pages between several people and lets all in', async () => {
		const { transport } = setup([knock(1), knock(2)]);
		await screen.findByText('anna-1');
		expect(screen.getByTestId('call-knock-position').textContent).toBe(
			'calls.knock.position(current=1,total=2)'
		);
		await userEvent.click(
			screen.getByRole('button', { name: 'calls.knock.next' })
		);
		expect(await screen.findByText('ben-2')).toBeTruthy();
		await userEvent.click(
			screen.getByRole('button', { name: 'calls.knock.next' })
		);
		expect(await screen.findByText('anna-1')).toBeTruthy();
		await userEvent.click(
			screen.getByRole('button', { name: 'calls.knock.previous' })
		);
		expect(await screen.findByText('ben-2')).toBeTruthy();

		await userEvent.click(
			screen.getByRole('button', { name: 'calls.knock.admitAll' })
		);
		expect(transport.decisions).toEqual(['admit-all:sessionId=501']);
		expect(screen.queryByTestId('call-knock-notice')).toBeNull();
	});

	it('works from the keyboard and keeps focus on "Einlassen" for the next person', async () => {
		const { transport } = setup([knock(1), knock(2)]);
		await screen.findByText('anna-1');
		const user = userEvent.setup();
		const admit = screen.getByRole('button', { name: 'calls.knock.admit' });
		admit.focus();
		await user.keyboard('{Enter}');
		expect(transport.decisions).toEqual(['admit:1']);
		expect(await screen.findByText('ben-2')).toBeTruthy();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'calls.knock.admit' })
		);
		await user.keyboard(' ');
		expect(transport.decisions).toEqual(['admit:1', 'admit:2']);
	});

	it('declines the person on the current page', async () => {
		const { transport } = setup([knock(1), knock(2)]);
		await screen.findByText('anna-1');
		await userEvent.click(
			screen.getByRole('button', { name: 'calls.knock.next' })
		);
		await userEvent.click(
			screen.getByRole('button', { name: 'calls.knock.decline' })
		);
		expect(transport.decisions).toEqual(['decline:2']);
		expect(await screen.findByText('anna-1')).toBeTruthy();
		expect(screen.queryByTestId('call-knock-position')).toBeNull();
	});

	it('ignores a second click while the first decision is on its way', async () => {
		const transport = createFakeCallKnockTransport([knock(1)]);
		let release: () => void = () => undefined;
		const admit = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				})
		);
		render(
			<CallKnockNoticeHost
				transport={{ ...transport, admit }}
				scope={SCOPE}
				playSound={vi.fn()}
			/>
		);
		const button = await screen.findByRole('button', {
			name: 'calls.knock.admit'
		});
		await userEvent.click(button);
		await waitFor(() =>
			expect(button.getAttribute('aria-disabled')).toBe('true')
		);
		await userEvent.click(button);
		expect(admit).toHaveBeenCalledTimes(1);
		await act(async () => release());
		await waitFor(() =>
			expect(screen.queryByTestId('call-knock-notice')).toBeNull()
		);
	});

	it('keeps the person when the decision fails', async () => {
		const transport = createFakeCallKnockTransport([knock(1)]);
		render(
			<CallKnockNoticeHost
				transport={{
					...transport,
					decline: () => Promise.reject(new Error('CATCH_ALL'))
				}}
				scope={SCOPE}
				playSound={vi.fn()}
			/>
		);
		await userEvent.click(
			await screen.findByRole('button', { name: 'calls.knock.decline' })
		);
		await waitFor(() =>
			expect(
				screen
					.getByRole('button', { name: 'calls.knock.decline' })
					.getAttribute('aria-disabled')
			).toBeNull()
		);
		expect(screen.getByText('anna-1')).toBeTruthy();
	});

	it('chimes once for every new arrival, not for every poll', async () => {
		const { transport, playSound } = setup([knock(1)]);
		await screen.findByText('anna-1');
		expect(playSound).toHaveBeenCalledTimes(1);
		act(() => transport.setPending([knock(1)]));
		expect(playSound).toHaveBeenCalledTimes(1);
		act(() => transport.setPending([knock(1), knock(2)]));
		expect(playSound).toHaveBeenCalledTimes(2);
		act(() => transport.setPending([knock(2)]));
		expect(playSound).toHaveBeenCalledTimes(2);
	});

	it('docks above a minimised call, outside it', async () => {
		const { view } = setup([knock(1)], { minimised: true });
		const notice = await screen.findByTestId('call-knock-notice');
		expect(notice.getAttribute('data-placement')).toBe('docked');
		expect(view.container.contains(notice)).toBe(false);
		expect(document.body.contains(notice)).toBe(true);
	});

	it('stays inside the call stage otherwise', async () => {
		const { view } = setup([knock(1)]);
		const notice = await screen.findByTestId('call-knock-notice');
		expect(notice.getAttribute('data-placement')).toBe('overlay');
		expect(view.container.contains(notice)).toBe(true);
	});

	it('does not ask the server when switched off', () => {
		const transport = createFakeCallKnockTransport([knock(1)]);
		const watchPending = vi.spyOn(transport, 'watchPending');
		render(
			<CallKnockNoticeHost
				enabled={false}
				transport={transport}
				scope={SCOPE}
				playSound={vi.fn()}
			/>
		);
		expect(watchPending).not.toHaveBeenCalled();
		expect(screen.queryByTestId('call-knock-notice')).toBeNull();
	});
});
