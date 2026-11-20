// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	apiCreateDirectLink,
	apiGetOwnDirectLinks,
	apiUpdateDirectLink,
	DIRECT_LINKS_CHANGED_EVENT
} from '../../../api/apiDirectLinks';
import { useDirectLinks } from './useDirectLinks';

vi.mock('../../../api/apiDirectLinks', async () => {
	const actual = await vi.importActual<
		typeof import('../../../api/apiDirectLinks')
	>('../../../api/apiDirectLinks');
	return {
		...actual,
		apiGetOwnDirectLinks: vi.fn(),
		apiCreateDirectLink: vi.fn(),
		apiUpdateDirectLink: vi.fn()
	};
});

/** What the API functions answer: the tile model. */
const link = (id: number, active = true) => ({
	id: String(id),
	name: `Link ${id}`,
	topic: 'Schulden',
	topicId: 4,
	medium: 'CHAT' as const,
	temporary: false,
	active,
	url: `https://app/invite/t${id}`
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([link(1)]);
});

describe('useDirectLinks', () => {
	it('loads the counsellor’s links', async () => {
		const { result } = renderHook(() => useDirectLinks());
		await waitFor(() => expect(result.current.loaded).toBe(true));
		expect(result.current.links.map((link) => link.id)).toEqual(['1']);
	});

	it('does not load when only creating', async () => {
		renderHook(() => useDirectLinks({ load: false }));
		expect(apiGetOwnDirectLinks).not.toHaveBeenCalled();
	});

	it('puts a new link first', async () => {
		vi.mocked(apiCreateDirectLink).mockResolvedValue(link(2));
		const { result } = renderHook(() => useDirectLinks());
		await waitFor(() => expect(result.current.loaded).toBe(true));
		await act(async () => {
			await result.current.create({ medium: 'CHAT', topicId: 4 });
		});
		expect(result.current.links.map((link) => link.id)).toEqual(['2', '1']);
	});

	it('tells an open "Meine Direktlinks" list about the new link', async () => {
		vi.mocked(apiCreateDirectLink).mockResolvedValue(link(2));
		const changed = vi.fn();
		window.addEventListener(DIRECT_LINKS_CHANGED_EVENT, changed);
		const { result } = renderHook(() => useDirectLinks({ load: false }));
		await act(async () => {
			await result.current.create({ medium: 'CHAT', topicId: 4 });
		});
		expect(changed).toHaveBeenCalledOnce();

		vi.mocked(apiCreateDirectLink).mockRejectedValue(new Error('nope'));
		await act(async () => {
			await result.current
				.create({ medium: 'CHAT', topicId: 4 })
				.catch(() => undefined);
		});
		// Only a link that was really created is announced.
		expect(changed).toHaveBeenCalledOnce();
		window.removeEventListener(DIRECT_LINKS_CHANGED_EVENT, changed);
	});

	it('switches a link and puts the switch back when the backend refuses', async () => {
		vi.mocked(apiUpdateDirectLink)
			.mockResolvedValueOnce(link(1, false))
			.mockRejectedValueOnce(new Error('nope'));
		const { result } = renderHook(() => useDirectLinks());
		await waitFor(() => expect(result.current.loaded).toBe(true));
		await act(() => result.current.toggle('1', false));
		expect(result.current.links[0].active).toBe(false);
		expect(apiUpdateDirectLink).toHaveBeenCalledWith('1', {
			active: false
		});
		await act(() => result.current.toggle('1', true));
		expect(result.current.links[0].active).toBe(false);
	});
});
