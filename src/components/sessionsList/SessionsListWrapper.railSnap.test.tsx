// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionsListWrapper } from './SessionsListWrapper';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { STAGE_LAYOUT } from '../chatStage/stageLayout';
import {
	ChatStagePanelProvider,
	useReportChatStagePanel
} from '../chatStage/ChatStagePanelContext';

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

/**
 * Like `renderAt`, but the open pane can be switched on the live tree — the
 * provider reads `initialOpenPanel` only once, so the test reports the pane
 * the way the chat card does (`useReportChatStagePanel`).
 */
const PanelSwitch = ({ panel }: { panel: 'supervision' | 'thread' | null }) => {
	const report = useReportChatStagePanel();
	React.useEffect(() => report(panel), [panel, report]);
	return null;
};

const renderWithPanel = (
	search: string,
	openPanel: 'supervision' | 'thread' | null,
	listWidth = LIST_WIDTH
) => {
	localStorage.setItem('sessionsList_width', String(listWidth));
	const tree = (panel: 'supervision' | 'thread' | null) => (
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
					<PanelSwitch panel={panel} />
					<SessionsListWrapper sessionTypes={[] as any} />
				</ChatStagePanelProvider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
	const utils = render(tree(openPanel));
	const wrapperOf = () =>
		utils.container.querySelector<HTMLElement>('.sessionsList__wrapper')!;
	return {
		wrapper: wrapperOf(),
		rerender: (panel: 'supervision' | 'thread' | null) => {
			act(() => {
				utils.rerender(tree(panel));
			});
			return wrapperOf();
		}
	};
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
		expect(
			renderAt('?channel=supervision', 'supervision').style.width
		).toBe(`${STAGE_LAYOUT.RAIL_WIDTH}px`);
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

	// T41b (Frank, 15.09.): the snap must not lock the handle — a reader who
	// wants the list beside an open side room gets it.
	it('lets the reader pull the list back out while a pane is open', () => {
		const wrapper = renderAt('?channel=supervision', 'supervision');
		expect(wrapper.style.width).toBe(`${STAGE_LAYOUT.RAIL_WIDTH}px`);
		act(() => resizeList?.(420));
		expect(wrapper.style.width).toBe('420px');
	});

	it('hands the snap back when the list is pushed to the rail again', () => {
		const wrapper = renderAt('?channel=supervision', 'supervision');
		act(() => resizeList?.(420));
		act(() => resizeList?.(STAGE_LAYOUT.RAIL_WIDTH));
		expect(wrapper.style.width).toBe(`${STAGE_LAYOUT.RAIL_WIDTH}px`);
	});

	it('never lets the list squeeze both panes below their drag floor', () => {
		// 1280: 604 is the panel-aware ceiling, the list's own maximum is 500.
		const wrapper = renderAt('?channel=supervision', 'supervision');
		act(() => resizeList?.(900));
		expect(Number.parseInt(wrapper.style.width, 10)).toBeLessThanOrEqual(
			500
		);
	});

	// Review (CodeRabbit): widening while nothing is open must not disarm the
	// snap for the side room the reader opens next.
	it('keeps the snap armed when the list was widened with no pane open', () => {
		const { rerender } = renderWithPanel('', null, STAGE_LAYOUT.RAIL_WIDTH);
		act(() => resizeList?.(420));
		const wrapper = rerender('supervision');
		expect(wrapper.style.width).toBe(`${STAGE_LAYOUT.RAIL_WIDTH}px`);
	});

	it('re-arms the snap once the pane is closed again', () => {
		const { rerender } = renderWithPanel(
			'?channel=supervision',
			'supervision'
		);
		act(() => resizeList?.(420));
		rerender(null);
		const wrapper = rerender('supervision');
		expect(wrapper.style.width).toBe(`${STAGE_LAYOUT.RAIL_WIDTH}px`);
	});

	it('re-arms the snap when switching from one open pane to another', () => {
		const { rerender } = renderWithPanel(
			'?channel=supervision',
			'supervision'
		);
		act(() => resizeList?.(420));
		const wrapper = rerender('thread');
		expect(wrapper.style.width).toBe(`${STAGE_LAYOUT.RAIL_WIDTH}px`);
	});
});
