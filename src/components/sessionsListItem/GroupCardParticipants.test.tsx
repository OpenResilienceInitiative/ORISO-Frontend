// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useGroupCardMembers } from '../../hooks/useGroupCardMembers';
import { GroupCardParticipants } from './GroupCardParticipants';

vi.mock('../../hooks/useGroupCardMembers', () => ({
	useGroupCardMembers: vi.fn()
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
afterEach(cleanup);

const members = (count: number) =>
	Array.from({ length: count }, (_, i) => ({
		userId: `@person-${i}:example.org`,
		name: `Person ${i}`,
		membership: 'join'
	}));

describe('GroupCardParticipants — production shared stack (#1806)', () => {
	it.each([1, 2, 3, 27])(
		'shows actual people and correct hidden count for %i members',
		(count) => {
			vi.mocked(useGroupCardMembers).mockReturnValue({
				status: 'ready',
				members: members(count) as never
			});
			const { container } = render(
				<GroupCardParticipants roomId="!group:example.org" enabled />
			);
			expect(
				container.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(Math.min(2, count));
			expect(
				container.querySelector(
					'[data-user-id="@person-0:example.org"]'
				)
			).not.toBeNull();
			const overflow = container.querySelector(
				'[data-cy="participant-overflow"]'
			);
			if (count > 2) expect(overflow?.textContent).toBe(`+${count - 2}`);
			else expect(overflow).toBeNull();
		}
	);

	it('separates loading/error from an empty group and never fabricates a count', () => {
		vi.mocked(useGroupCardMembers).mockReturnValue({
			status: 'loading',
			members: []
		});
		const { container, rerender } = render(
			<GroupCardParticipants roomId="!group:example.org" enabled />
		);
		expect(
			container
				.querySelector('[role="status"]')
				?.getAttribute('aria-label')
		).toBe('groupCardParticipants.loading');
		expect(
			container.querySelector('[data-cy="participant-overflow"]')
		).toBeNull();
		vi.mocked(useGroupCardMembers).mockReturnValue({
			status: 'error',
			members: []
		});
		rerender(<GroupCardParticipants roomId="!group:example.org" enabled />);
		expect(
			container
				.querySelector('[role="status"]')
				?.getAttribute('aria-label')
		).toBe('groupCardParticipants.unavailable');
		vi.mocked(useGroupCardMembers).mockReturnValue({
			status: 'ready',
			members: []
		});
		rerender(<GroupCardParticipants roomId="!group:example.org" enabled />);
		expect(
			container.querySelector('[data-cy="group-card-members-empty"]')
		).not.toBeNull();
		rerender(
			<GroupCardParticipants
				roomId="!group:example.org"
				enabled={false}
			/>
		);
		expect(container.innerHTML).toBe('');
	});
});
