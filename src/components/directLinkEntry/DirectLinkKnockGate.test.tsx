// @vitest-environment oriso-jsdom

import * as React from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext } from '../../globalState';

const knockState = vi.hoisted(() => ({ current: null as any }));
vi.mock('./useDirectLinkKnock', () => ({
	useDirectLinkKnock: () => knockState.current
}));
vi.mock('../knockWaitDialog/KnockWaitDialog', () => ({
	KnockWaitDialog: () => <div data-testid="knock-dialog" />
}));
vi.mock('../waitingRoom/callEntry/useLiveCallDevices', () => ({
	useLiveCallDevices: () => ({
		devices: [],
		stream: null,
		micLevel: 0,
		cameraMissing: false
	})
}));
vi.mock('react-i18next', () => {
	const t = (key: string) =>
		({
			'directLink.entry.inactive': 'Dieser Link ist nicht mehr aktiv.',
			'directLink.entry.callsDisabled': 'Anrufe sind nicht möglich.'
		})[key] ?? key;
	return { useTranslation: () => ({ t }) };
});

const { DirectLinkKnock } = await import('./DirectLinkKnockGate');

const knock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: '!room:oriso',
	medium: 'VIDEO' as const,
	status: 'DECLINED' as const
};

const state = (over: object) => ({
	phase: 'declined',
	gone: false,
	refusalKey: null,
	cancel: vi.fn(),
	knockAgain: vi.fn(),
	close: vi.fn(),
	...over
});

const mount = () => {
	const addNotification = vi.fn();
	const onDone = vi.fn();
	render(
		<NotificationsContext.Provider
			value={{ addNotification } as unknown as never}
		>
			<DirectLinkKnock
				knock={knock}
				onDone={onDone}
				onAdmitted={vi.fn()}
			/>
		</NotificationsContext.Provider>
	);
	return { addNotification, onDone };
};

describe('DirectLinkKnock when the dialog goes', () => {
	afterEach(() => {
		knockState.current = null;
	});

	it('says the link is no longer active when it was switched off (#2012)', () => {
		knockState.current = state({
			gone: true,
			refusalKey: 'directLink.entry.inactive'
		});
		const { addNotification, onDone } = mount();
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Dieser Link ist nicht mehr aktiv.'
			})
		);
		expect(onDone).toHaveBeenCalled();
	});

	it('says calls are not possible when the form of counselling has none', () => {
		knockState.current = state({
			gone: true,
			refusalKey: 'directLink.entry.callsDisabled'
		});
		const { addNotification } = mount();
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Anrufe sind nicht möglich.' })
		);
	});

	it('closes silently for any other reason', () => {
		knockState.current = state({ gone: true });
		const { addNotification, onDone } = mount();
		expect(addNotification).not.toHaveBeenCalled();
		expect(onDone).toHaveBeenCalled();
	});
});
