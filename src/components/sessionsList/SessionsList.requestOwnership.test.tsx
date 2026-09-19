// @vitest-environment jsdom
import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionsList } from './SessionsList';
import {
	SessionsDataContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { messageEventEmitter } from '../../services/messageEventEmitter';

const getList = vi.hoisted(() => vi.fn());
vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api')>()),
	apiGetConsultantSessionList: getList
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../globalState', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../globalState')>()),
	useTenant: () => ({})
}));
vi.mock('./SessionsListToolbar', async (importOriginal) => ({
	...(await importOriginal<typeof import('./SessionsListToolbar')>()),
	SessionsListToolbar: ({ onChipToggle }) => (
		<button onClick={() => onChipToggle('liveChat')}>Live chat</button>
	)
}));
vi.mock('../displayFilter', async (importOriginal) => ({
	...(await importOriginal<typeof import('../displayFilter')>()),
	DisplayFilterDialog: () => null
}));
afterEach(() => cleanup());

function renderEnquiries(dispatch = vi.fn()) {
	return render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionPreview']}>
			<UserDataContext.Provider
				value={
					{
						userData: { userRoles: ['consultant'] },
						setUserData: vi.fn()
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={
						{
							type: SESSION_LIST_TYPES.ENQUIRY,
							path: '/sessions/consultant/sessionPreview'
						} as any
					}
				>
					<SessionsDataContext.Provider
						value={{ sessions: [], dispatch } as any}
					>
						<SessionsList
							defaultLanguage="de"
							sessionTypes={[] as any}
						/>
					</SessionsDataContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
}

it.each(['abort', 'late-success', 'late-failure'])(
	'allows pagination after live refresh supersedes a pending page (%s)',
	async (settlement) => {
		getList.mockReset();
		getList.mockResolvedValue({ sessions: [], total: 100 });
		const dispatch = vi.fn();
		const view = renderEnquiries(dispatch);
		await waitFor(() => expect(getList).toHaveBeenCalledTimes(1));
		let finish!: (value: { sessions: []; total: number }) => void;
		let fail!: (error: Error) => void;
		getList.mockReturnValueOnce(
			new Promise((resolve, reject) => {
				finish = resolve;
				fail = reject;
			})
		);
		const scroll = view.container.querySelector(
			'.sessionsList__scrollContainer'
		)!;
		fireEvent.scroll(scroll);
		await waitFor(() => expect(getList).toHaveBeenCalledTimes(2));
		let finishRefresh!: (value: { sessions: []; total: number }) => void;
		getList.mockReturnValueOnce(
			new Promise((resolve) => {
				finishRefresh = resolve;
			})
		);
		act(() => messageEventEmitter.emit({ refreshEnquiryList: true }));
		await waitFor(() => expect(getList).toHaveBeenCalledTimes(3));
		const refreshWrites = dispatch.mock.calls.length;
		await act(async () => {
			if (settlement === 'abort') fail(new Error('ABORT'));
			else if (settlement === 'late-failure')
				fail(new Error('CATCH_ALL'));
			else finish({ sessions: [], total: 999 });
		});
		expect(dispatch.mock.calls.length).toBe(refreshWrites);
		fireEvent.scroll(scroll);
		expect(getList).toHaveBeenCalledTimes(3);
		await act(async () => finishRefresh({ sessions: [], total: 100 }));
		fireEvent.scroll(scroll);
		await waitFor(() => expect(getList).toHaveBeenCalledTimes(4));
		expect(getList.mock.calls[3][0].offset).toBe(
			getList.mock.calls[1][0].offset
		);
	}
);

it.each([
	['initial', 'abort'],
	['initial', 'late-success'],
	['initial', 'late-failure'],
	['chip', 'abort'],
	['chip', 'late-success'],
	['chip', 'late-failure']
])(
	'keeps loading while refresh replaces a %s request (%s)',
	async (request, settlement) => {
		getList.mockReset();
		getList.mockResolvedValue({ sessions: [], total: 0 });
		let finish!: (value: { sessions: []; total: number }) => void;
		let fail!: (error: Error) => void;
		const pending = new Promise((resolve, reject) => {
			finish = resolve;
			fail = reject;
		});
		if (request === 'initial') getList.mockReturnValueOnce(pending);
		const view = renderEnquiries();
		await waitFor(() => expect(getList).toHaveBeenCalledTimes(1));
		if (request === 'chip') {
			await waitFor(() =>
				expect(view.container.querySelector('.skeleton')).toBeNull()
			);
			getList.mockReturnValueOnce(pending);
			fireEvent.click(view.getByRole('button', { name: 'Live chat' }));
			await waitFor(() => expect(getList).toHaveBeenCalledTimes(2));
		}
		expect(view.container.querySelector('.skeleton')).not.toBeNull();
		let finishRefresh!: (value: { sessions: []; total: number }) => void;
		getList.mockReturnValueOnce(
			new Promise((resolve) => {
				finishRefresh = resolve;
			})
		);
		act(() => messageEventEmitter.emit({ refreshEnquiryList: true }));
		await waitFor(() =>
			expect(getList).toHaveBeenCalledTimes(request === 'initial' ? 2 : 3)
		);
		await act(async () => {
			if (settlement === 'late-success')
				finish({ sessions: [], total: 999 });
			else
				fail(new Error(settlement === 'abort' ? 'ABORT' : 'CATCH_ALL'));
		});
		expect(view.container.querySelector('.skeleton')).not.toBeNull();
		await act(async () => finishRefresh({ sessions: [], total: 0 }));
		expect(view.container.querySelector('.skeleton')).toBeNull();
	}
);
