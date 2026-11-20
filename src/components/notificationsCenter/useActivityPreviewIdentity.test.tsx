// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { SessionsDataContext, UserDataContext } from '../../globalState';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { useActivityPreviewHydration } from './useActivityPreviewHydration';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

const makeCard = (room: string, event: string) =>
	({
		id: 'same',
		eventType: 'message.new',
		sourceSessionId: '13',
		params: { roomRef: room, matrixEventId: event }
	}) as any;
const session = (room: string, owner: string) => ({
	session: { id: 13, matrixRoomId: room, groupId: room, status: 2 },
	consultant: { id: owner }
});

describe('preview source identity', () => {
	it('rejects previous text and late callbacks after a room or event change', () => {
		const client = { on: vi.fn(), off: vi.fn() };
		const service = {
			getClient: () => client,
			onClientChange: () => () => {}
		};
		let room = '!a:x';
		let event = '$a';
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'me',
							userName: 'me',
							userRoles: ['consultant']
						}
					} as any
				}
			>
				<MatrixClientContext.Provider
					value={{ matrixClientService: service } as any}
				>
					<SessionsDataContext.Provider
						value={{ sessions: [session(room, 'me')] } as any}
					>
						{children}
					</SessionsDataContext.Provider>
				</MatrixClientContext.Provider>
			</UserDataContext.Provider>
		);
		const { result, rerender } = renderHook(
			() => useActivityPreviewHydration([makeCard(room, event)]),
			{ wrapper }
		);
		const oldCallback = result.current.onPreviewChange;
		act(() => oldCallback('same', 'secret A', 'text'));
		expect(result.current.visiblePreview('same')?.text).toBe('secret A');
		room = '!b:x';
		event = '$b';
		rerender();
		expect(result.current.visiblePreview('same')).toBeUndefined();
		act(() => oldCallback('same', 'late A', 'text'));
		expect(result.current.visiblePreview('same')).toBeUndefined();
		act(() => result.current.onPreviewChange('same', 'text B', 'text'));
		expect(result.current.visiblePreview('same')?.text).toBe('text B');
		room = '!a:x';
		event = '$a';
		rerender();
		act(() => oldCallback('same', 'late original A', 'text'));
		expect(result.current.visiblePreview('same')).toBeUndefined();
	});

	it('rejects a previous account and Matrix client callback', () => {
		let client = { on: vi.fn(), off: vi.fn() };
		const listeners = new Set<() => void>();
		let viewer = 'one';
		const service = {
			getClient: () => client,
			onClientChange: (fn: () => void) => {
				listeners.add(fn);
				return () => {
					listeners.delete(fn);
				};
			}
		};
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: viewer,
							userName: viewer,
							userRoles: ['consultant']
						}
					} as any
				}
			>
				<MatrixClientContext.Provider
					value={{ matrixClientService: service } as any}
				>
					<SessionsDataContext.Provider
						value={{ sessions: [session('!a:x', viewer)] } as any}
					>
						{children}
					</SessionsDataContext.Provider>
				</MatrixClientContext.Provider>
			</UserDataContext.Provider>
		);
		const { result, rerender } = renderHook(
			() => useActivityPreviewHydration([makeCard('!a:x', '$a')]),
			{ wrapper }
		);
		const oldCallback = result.current.onPreviewChange;
		act(() => oldCallback('same', 'secret', 'text'));
		viewer = 'two';
		client = { on: vi.fn(), off: vi.fn() };
		act(() => listeners.forEach((fn) => fn()));
		rerender();
		expect(result.current.visiblePreview('same')).toBeUndefined();
		act(() => oldCallback('same', 'late secret', 'text'));
		expect(result.current.visiblePreview('same')).toBeUndefined();
	});
});
