// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAgencyConsultantList } from '../../api/apiGetAgencyConsultantList';
import { useSupervisorConsultantDirectory } from './useSupervisorConsultantDirectory';

vi.mock('../../api/apiGetAgencyConsultantList', () => ({
	fetchAgencyConsultantList: vi.fn()
}));

const consultant = (consultantId: string) => ({
	consultantId,
	firstName: consultantId,
	lastName: 'Consultant',
	displayName: consultantId,
	username: consultantId,
	isSupervisor: true
});

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

describe('useSupervisorConsultantDirectory', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('re-filters a loaded directory when the current supervisors change', async () => {
		const directory = deferred<ReturnType<typeof consultant>[]>();
		vi.mocked(fetchAgencyConsultantList).mockReturnValue(directory.promise);
		const onLoadError = vi.fn();
		const { result, rerender } = renderHook(
			({ supervisors, supervisorState }) =>
				useSupervisorConsultantDirectory({
					isOpen: true,
					sessionId: 42,
					agencyId: '7',
					currentConsultantId: 'self',
					supervisorState,
					supervisors,
					onLoadError
				}),
			{
				initialProps: {
					supervisorState: 'loading' as 'loading' | 'ready' | 'error',
					supervisors: [] as Array<{
						supervisorConsultantId: string;
					}>
				}
			}
		);

		expect(fetchAgencyConsultantList).toHaveBeenCalledWith('7');
		expect(result.current.state).toBe('loading');

		await act(async () => {
			directory.resolve([
				consultant('eligible'),
				consultant('already-assigned'),
				consultant('self')
			]);
			await directory.promise;
		});

		expect(result.current.state).toBe('loading');
		expect(result.current.consultants).toEqual([]);

		rerender({
			supervisorState: 'ready',
			supervisors: [{ supervisorConsultantId: 'already-assigned' }]
		});

		expect(result.current.state).toBe('ready');
		expect(result.current.consultants).toEqual([consultant('eligible')]);
		act(() => result.current.setSelectedConsultantId('eligible'));

		rerender({
			supervisorState: 'ready',
			supervisors: [
				{ supervisorConsultantId: 'already-assigned' },
				{ supervisorConsultantId: 'eligible' }
			]
		});

		expect(result.current.selectedConsultant).toBeNull();
		await waitFor(() =>
			expect(result.current.selectedConsultantId).toBe('')
		);
		expect(fetchAgencyConsultantList).toHaveBeenCalledTimes(1);
		expect(onLoadError).not.toHaveBeenCalled();
	});

	it('fails closed when the current supervisor list cannot be loaded', async () => {
		vi.mocked(fetchAgencyConsultantList).mockResolvedValue([
			consultant('eligible')
		]);
		const { result, rerender } = renderHook(
			({ supervisorState }) =>
				useSupervisorConsultantDirectory({
					isOpen: true,
					sessionId: 42,
					agencyId: '7',
					currentConsultantId: 'self',
					supervisorState,
					supervisors: [],
					onLoadError: vi.fn()
				}),
			{
				initialProps: {
					supervisorState: 'loading' as 'loading' | 'ready' | 'error'
				}
			}
		);

		await waitFor(() =>
			expect(fetchAgencyConsultantList).toHaveBeenCalledWith('7')
		);
		expect(result.current.state).toBe('loading');
		expect(result.current.consultants).toEqual([]);

		rerender({ supervisorState: 'error' });

		expect(result.current.state).toBe('error');
		expect(result.current.consultants).toEqual([]);
		expect(result.current.selectedConsultant).toBeNull();
	});

	it('fails closed without requesting a directory when the agency is missing', () => {
		const { result } = renderHook(() =>
			useSupervisorConsultantDirectory({
				isOpen: true,
				sessionId: 42,
				agencyId: null,
				currentConsultantId: 'self',
				supervisorState: 'ready',
				supervisors: [],
				onLoadError: vi.fn()
			})
		);

		expect(result.current.state).toBe('error');
		expect(result.current.consultants).toEqual([]);
		expect(result.current.selectedConsultant).toBeNull();
		expect(fetchAgencyConsultantList).not.toHaveBeenCalled();
	});

	it('reports an active directory request failure', async () => {
		const onLoadError = vi.fn();
		vi.mocked(fetchAgencyConsultantList).mockRejectedValue(
			new Error('directory unavailable')
		);
		const { result } = renderHook(() =>
			useSupervisorConsultantDirectory({
				isOpen: true,
				sessionId: 42,
				agencyId: '7',
				currentConsultantId: 'self',
				supervisorState: 'ready',
				supervisors: [],
				onLoadError
			})
		);

		await waitFor(() => expect(result.current.state).toBe('error'));
		expect(result.current.consultants).toEqual([]);
		expect(result.current.selectedConsultant).toBeNull();
		expect(onLoadError).toHaveBeenCalledTimes(1);
	});

	it('ignores an earlier session directory response that resolves last', async () => {
		const first = deferred<ReturnType<typeof consultant>[]>();
		const second = deferred<ReturnType<typeof consultant>[]>();
		vi.mocked(fetchAgencyConsultantList)
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const onLoadError = vi.fn();
		const { result, rerender } = renderHook(
			({ sessionId, agencyId }) =>
				useSupervisorConsultantDirectory({
					isOpen: true,
					sessionId,
					agencyId,
					currentConsultantId: 'self',
					supervisorState: 'ready',
					supervisors: [],
					onLoadError
				}),
			{ initialProps: { sessionId: 1, agencyId: 'old-agency' } }
		);

		rerender({ sessionId: 2, agencyId: 'current-agency' });
		expect(fetchAgencyConsultantList).toHaveBeenNthCalledWith(
			2,
			'current-agency'
		);

		await act(async () => {
			second.resolve([consultant('current')]);
			await second.promise;
		});
		await waitFor(() =>
			expect(result.current.consultants).toEqual([consultant('current')])
		);

		await act(async () => {
			first.resolve([consultant('stale')]);
			await first.promise;
		});

		expect(result.current.consultants).toEqual([consultant('current')]);
		expect(onLoadError).not.toHaveBeenCalled();
	});

	it('clears a retained selection when the active directory changes', async () => {
		vi.mocked(fetchAgencyConsultantList).mockResolvedValue([
			consultant('eligible')
		]);
		const { result, rerender } = renderHook(
			({ sessionId, isOpen }) =>
				useSupervisorConsultantDirectory({
					isOpen,
					sessionId,
					agencyId: '7',
					currentConsultantId: 'self',
					supervisorState: 'ready',
					supervisors: [],
					onLoadError: vi.fn()
				}),
			{ initialProps: { sessionId: 1, isOpen: true } }
		);

		await waitFor(() => expect(result.current.state).toBe('ready'));
		act(() => result.current.setSelectedConsultantId('eligible'));
		expect(result.current.selectedConsultantId).toBe('eligible');

		rerender({ sessionId: 2, isOpen: true });

		await waitFor(() =>
			expect(result.current.selectedConsultantId).toBe('')
		);
		await waitFor(() => expect(result.current.state).toBe('ready'));
		act(() => result.current.setSelectedConsultantId('eligible'));

		rerender({ sessionId: 2, isOpen: false });

		expect(result.current.selectedConsultant).toBeNull();
		await waitFor(() =>
			expect(result.current.selectedConsultantId).toBe('')
		);
	});

	it('does not surface an error from a stale directory request', async () => {
		const first = deferred<ReturnType<typeof consultant>[]>();
		vi.mocked(fetchAgencyConsultantList)
			.mockReturnValueOnce(first.promise)
			.mockResolvedValueOnce([consultant('current')]);
		const onLoadError = vi.fn();
		const { result, rerender } = renderHook(
			({ sessionId }) =>
				useSupervisorConsultantDirectory({
					isOpen: true,
					sessionId,
					agencyId: '7',
					currentConsultantId: 'self',
					supervisorState: 'ready',
					supervisors: [],
					onLoadError
				}),
			{ initialProps: { sessionId: 1 } }
		);

		rerender({ sessionId: 2 });
		await waitFor(() =>
			expect(result.current.consultants).toEqual([consultant('current')])
		);

		await act(async () => {
			first.reject(new Error('stale failure'));
			try {
				await first.promise;
			} catch {
				// The hook owns request failure handling.
			}
		});

		expect(result.current.state).toBe('ready');
		expect(onLoadError).not.toHaveBeenCalled();
	});
});
