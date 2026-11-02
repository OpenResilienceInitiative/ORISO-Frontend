// @vitest-environment oriso-jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import englishCatalogue from '../../../resources/i18n/en/common.json';
import { IncomingCallCard } from './IncomingCallCard';
import { formatCallDuration, MinimizedCallDock } from './MinimizedCallDock';
import type { CallParty } from '../callParty';

const i18n = createInstance();
beforeAll(async () => {
	await i18n.use(initReactI18next).init({
		lng: 'en',
		resources: { en: { common: englishCatalogue } },
		defaultNS: 'common'
	});
});
afterEach(cleanup);

const party: CallParty = {
	name: 'ruhiger Fuchs 432',
	avatar: {
		userId: '@fuchs:test',
		username: 'fuchs',
		displayName: 'ruhiger Fuchs 432',
		choice: null
	}
};

const renderIn = (node: React.ReactNode) =>
	render(
		<I18nextProvider i18n={i18n}>
			{/* A transformed ancestor turns `position: fixed` into a trap. */}
			<div data-testid="transformed" style={{ transform: 'scale(1)' }}>
				{node}
			</div>
		</I18nextProvider>
	);

describe('call states (FE#1904)', () => {
	it('formats the duration as the call card does', () => {
		expect(formatCallDuration(0)).toBe('0:00');
		expect(formatCallDuration(724)).toBe('12:04');
		expect(formatCallDuration(3725)).toBe('1:02:05');
	});

	it('portals the incoming card out of a transformed parent', () => {
		renderIn(
			<IncomingCallCard
				caller={party}
				isVideo
				onAnswer={vi.fn()}
				onDecline={vi.fn()}
			/>
		);
		const card = screen.getByRole('alertdialog', {
			name: 'ruhiger Fuchs 432',
			// Announced with what kind of call it is.
			description: /Video call.*Encrypted/
		});
		expect(screen.getByTestId('transformed').contains(card)).toBe(false);
	});

	it('names an unknown caller generically, without a letter avatar', () => {
		renderIn(
			<IncomingCallCard
				caller={null}
				isVideo={false}
				onAnswer={vi.fn()}
				onDecline={vi.fn()}
			/>
		);
		expect(
			screen.getByRole('alertdialog', { name: 'Someone is calling…' })
		).toBeTruthy();
		expect(screen.queryByTestId('user-avatar')).toBeNull();
	});

	it('says that answering ends the running call', () => {
		renderIn(
			<IncomingCallCard
				caller={party}
				isVideo={false}
				ongoingCall={{
					name: 'Frau Keller',
					avatars: [{ ...party.avatar, userId: '@keller:test' }]
				}}
				onAnswer={vi.fn()}
				onDecline={vi.fn()}
			/>
		);
		expect(
			screen.getByText('Answering ends your call with Frau Keller.')
		).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'End call and answer' })
		).toBeTruthy();
	});

	it('says only "your current call" when it does not know whom with', () => {
		renderIn(
			<IncomingCallCard
				caller={party}
				isVideo={false}
				ongoingCall={{ name: '', avatars: [] }}
				onAnswer={vi.fn()}
				onDecline={vi.fn()}
			/>
		);
		expect(
			screen.getByText('Answering ends your current call.')
		).toBeTruthy();
		// No avatar to strike out, so no stray strike line either.
		expect(
			document.querySelector('.incoming-call-card__ending')
		).toBeNull();
	});

	it('docks with mute, back and hang-up, and reports the mute state', () => {
		const onToggleMute = vi.fn();
		renderIn(
			<MinimizedCallDock
				party={party}
				elapsedSeconds={724}
				isMuted
				onToggleMute={onToggleMute}
				onHangUp={vi.fn()}
				onExpand={vi.fn()}
			/>
		);
		// One fixed label; the state is in aria-pressed alone.
		const mute = screen.getByRole('button', {
			name: 'Mute',
			pressed: true
		});
		mute.click();
		expect(onToggleMute).toHaveBeenCalledTimes(1);
		expect(
			screen.getByRole('button', { name: 'Back to the full call' })
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'End call' })).toBeTruthy();
		expect(screen.getByText('12:04')).toBeTruthy();
	});

	it('draws a neutral glyph, not a made-up animal, for a group call', () => {
		renderIn(
			<MinimizedCallDock
				party={{ name: 'Group call' }}
				isGroup
				elapsedSeconds={5}
				isMuted={false}
				onToggleMute={vi.fn()}
				onHangUp={vi.fn()}
				onExpand={vi.fn()}
			/>
		);
		expect(
			screen.getByRole('region', { name: 'Call with Group call' })
		).toBeTruthy();
		expect(screen.queryByTestId('user-avatar')).toBeNull();
	});

	it('offers the camera in its menu for a video call, and returns focus to ⋮', async () => {
		const user = userEvent.setup();
		const onToggleCamera = vi.fn();
		renderIn(
			<MinimizedCallDock
				party={party}
				elapsedSeconds={5}
				isMuted={false}
				isVideo
				onToggleMute={vi.fn()}
				onToggleCamera={onToggleCamera}
				onHangUp={vi.fn()}
				onExpand={vi.fn()}
			/>
		);
		const more = screen.getByRole('button', { name: 'More options' });
		await user.click(more);
		const camera = await screen.findByRole('menuitem', {
			name: /Turn off video/
		});
		expect(camera.textContent).toContain('Sound keeps going.');
		await user.keyboard('{Enter}');
		expect(onToggleCamera).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(more);
	});

	it('leaves the camera out of the menu for an audio call', async () => {
		const user = userEvent.setup();
		renderIn(
			<MinimizedCallDock
				party={party}
				elapsedSeconds={5}
				isMuted={false}
				onToggleMute={vi.fn()}
				onHangUp={vi.fn()}
				onExpand={vi.fn()}
			/>
		);
		await user.click(screen.getByRole('button', { name: 'More options' }));
		expect(
			await screen.findByRole('menuitem', {
				name: 'Back to the full call'
			})
		).toBeTruthy();
		expect(screen.queryByRole('menuitem', { name: /video/i })).toBeNull();
	});
});
