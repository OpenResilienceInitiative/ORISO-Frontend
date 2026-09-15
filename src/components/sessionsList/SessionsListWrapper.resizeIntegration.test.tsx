// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionsListWrapper } from './SessionsListWrapper';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { ChatStagePanelProvider } from '../chatStage/ChatStagePanelContext';

// Exercise the real resize handle against the list wrapper; only the list's
// unrelated chat data and responsive viewport are replaced.
vi.mock('./SessionsList', () => ({
	SessionsList: () => <div data-testid="list" />
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true })
}));
const viewport = vi.hoisted(() => ({ width: 1280 }));
vi.mock('../chatStage/useViewportWidth', () => ({
	// 1280 − 420 − 36 < 2 × 520: with a pane open the list must go to the rail.
	useViewportWidth: () => viewport.width
}));
vi.mock('./sessionsList.styles', () => ({}));
// The session helpers transitively pull in lottie-web, which needs a canvas
// jsdom does not have — unrelated to the rail rule under test.
vi.mock('lottie-react', () => ({ default: () => null }));

const LIST_WIDTH = 420;

const renderAt = (
	search: string,
	openPanel: 'supervision' | 'team' | 'thread' | null,
	listWidth = LIST_WIDTH
) => {
	localStorage.setItem('sessionsList_width', String(listWidth));
	const utils = render(
		<MemoryRouter
			initialEntries={[`/sessions/consultant/sessionView/1/2${search}`]}
		>
			<UserDataContext.Provider
				value={{
					userData: { userRoles: ['consultant'] } as any,
					setUserData: () => undefined
				}}
			>
				<ChatStagePanelProvider initialOpenPanel={openPanel}>
					<SessionsListWrapper sessionTypes={[] as any} />
				</ChatStagePanelProvider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
	const wrapper = utils.container.querySelector<HTMLElement>(
		'.sessionsList__wrapper'
	)!;
	return wrapper;
};

afterEach(() => {
	cleanup();
	localStorage.clear();
	viewport.width = 1280;
});

describe('List width beside a side panel', () => {
	it.each(['supervision', 'team'] as const)(
		'allows widening the list through its handle beside %s',
		(panel) => {
			const wrapper = renderAt(`?channel=${panel}`, panel);
			expect(wrapper.style.width).toBe('80px');
			const handle = wrapper.querySelector('[role="separator"]')!;
			fireEvent.keyDown(handle, { key: 'End' });
			expect(wrapper.style.width).toBe('500px');
			expect(localStorage.getItem('sessionsList_width')).toBe('500');
			fireEvent.keyDown(handle, { key: 'Home' });
			expect(wrapper.style.width).toBe('80px');
		}
	);
	it.each(['supervision', 'team'] as const)(
		'leaves space for both panes when dragging the list beside %s',
		(panel) => {
			viewport.width = 1024;
			const wrapper = renderAt(`?channel=${panel}`, panel);
			const handle = wrapper.querySelector('[role="separator"]')!;
			fireEvent(
				handle,
				new MouseEvent('pointerdown', {
					bubbles: true,
					button: 0,
					clientX: 80
				})
			);
			fireEvent(
				document,
				new MouseEvent('pointermove', { bubbles: true, clientX: 600 })
			);
			fireEvent(document, new MouseEvent('pointerup', { bubbles: true }));
			// 1024px viewport leaves 348px for the list and 320px per pane.
			expect(wrapper.style.width).toBe('348px');
			expect(handle.getAttribute('aria-valuemax')).toBe('348');
		}
	);
});
