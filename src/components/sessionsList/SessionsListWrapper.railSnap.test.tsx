// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionsListWrapper } from './SessionsListWrapper';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { STAGE_LAYOUT } from '../chatStage/stageLayout';
import { ChatStagePanelProvider } from '../chatStage/ChatStagePanelContext';

/**
 * Review B2 D-4: the list column snaps to the icon rail while a side pane
 * is ACTUALLY open — not whenever `?channel=` sits in the URL. An asker
 * with a forwarded link, a thread whose root is not loaded, or a missing
 * side room all keep the URL param but show no pane; the list must not
 * collapse to a rail beside an ordinary chat.
 */
vi.mock('./SessionsList', () => ({
	SessionsList: () => <div data-testid="list" />
}));
let resizeList: ((width: number) => void) | undefined;
vi.mock('./ResizableHandle', () => ({
	ResizableHandle: ({ onResize }: { onResize: (width: number) => void }) => {
		resizeList = onResize;
		return <div data-testid="handle" />;
	}
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true })
}));
vi.mock('../chatStage/useViewportWidth', () => ({
	// 1280 − 420 − 36 < 2 × 520: with a pane open the list must go to the rail.
	useViewportWidth: () => 1280
}));
vi.mock('./sessionsList.styles', () => ({}));
// The session helpers transitively pull in lottie-web, which needs a canvas
// jsdom does not have — unrelated to the rail rule under test.
vi.mock('lottie-react', () => ({ default: () => null }));

const LIST_WIDTH = 420;

const renderAt = (
	search: string,
	openPanel: 'supervision' | 'thread' | null,
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
});

describe('SessionsListWrapper rail snap (review B2 D-4)', () => {
	it('keeps the expanded list while ?channel= is in the URL but no pane is open', () => {
		expect(renderAt('?channel=supervision', null).style.width).toBe(
			`${LIST_WIDTH}px`
		);
	});

	it('snaps to the rail while the supervision pane is actually open', () => {
		expect(renderAt('?channel=supervision', 'supervision').style.width).toBe(
			`${STAGE_LAYOUT.RAIL_WIDTH}px`
		);
	});

	it('snaps to the rail for an open thread pane as well', () => {
		expect(renderAt('?channel=thread:%24root', 'thread').style.width).toBe(
			`${STAGE_LAYOUT.RAIL_WIDTH}px`
		);
	});

	it('stays expanded with no channel at all', () => {
		expect(renderAt('', null).style.width).toBe(`${LIST_WIDTH}px`);
	});

	it('accepts expansion from rail width when no pane is open', () => {
		const wrapper = renderAt('', null, STAGE_LAYOUT.RAIL_WIDTH);
		expect(wrapper.style.width).toBe(`${STAGE_LAYOUT.RAIL_WIDTH}px`);
		act(() => resizeList?.(420));
		expect(wrapper.style.width).toBe('420px');
		expect(localStorage.getItem('sessionsList_width')).toBe('420');
	});
});
