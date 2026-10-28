// @vitest-environment oriso-jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
			name: 'ruhiger Fuchs 432'
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
		const unmute = screen.getByRole('button', { name: 'Unmute' });
		expect(unmute.getAttribute('aria-pressed')).toBe('true');
		unmute.click();
		expect(onToggleMute).toHaveBeenCalledTimes(1);
		expect(
			screen.getByRole('button', { name: 'Back to the full call' })
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'End call' })).toBeTruthy();
		expect(screen.getByText('12:04')).toBeTruthy();
	});

	it('offers the camera in its menu for a video call', async () => {
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
		screen.getByRole('button', { name: 'More options' }).click();
		(
			await screen.findByRole('menuitem', { name: 'Turn off video' })
		).click();
		expect(onToggleCamera).toHaveBeenCalledTimes(1);
	});

	it('leaves the camera out of the menu for an audio call', async () => {
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
		screen.getByRole('button', { name: 'More options' }).click();
		expect(
			await screen.findByRole('menuitem', {
				name: 'Back to the full call'
			})
		).toBeTruthy();
		expect(screen.queryByRole('menuitem', { name: /video/i })).toBeNull();
	});
});
