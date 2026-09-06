// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberAvatarStack, StackMember } from './MemberAvatarStack';
import { AVATAR_STACK_METRICS } from './GroupChatHeader/memberActivity';

vi.mock('../message/UserAvatar', () => ({
	UserAvatar: ({ userId }: { userId: string }) => (
		<span data-testid="user-avatar" data-user-id={userId} />
	)
}));
vi.mock('../../resources/img/icons/persons-two.svg', () => ({
	ReactComponent: () => <svg data-testid="people-icon" />
}));

const members = (count: number): StackMember[] =>
	Array.from({ length: count }, (_, i) => ({
		userId: `@m${i}:x`,
		username: `m${i}`,
		displayName: `Member ${i}`
	}));

describe('MemberAvatarStack (#1193 Job 2)', () => {
	afterEach(cleanup);

	it('renders every member when there are at most four', () => {
		render(<MemberAvatarStack members={members(3)} />);
		expect(screen.getAllByTestId('user-avatar')).toHaveLength(3);
		expect(screen.queryByTestId('member-avatar-overflow')).toBeNull();
	});

	it('shows four avatars and "+23" for 27 members (report example)', () => {
		render(<MemberAvatarStack members={members(27)} />);
		expect(screen.getAllByTestId('user-avatar')).toHaveLength(4);
		const chip = screen.getByTestId('member-avatar-overflow');
		expect(within(chip).getByText('+23')).toBeTruthy();
		expect(within(chip).getByTestId('people-icon')).toBeTruthy();
	});

	it('keeps the caller order: the first member is rendered first', () => {
		render(<MemberAvatarStack members={members(5)} />);
		const ids = screen
			.getAllByTestId('user-avatar')
			.map((el) => el.getAttribute('data-user-id'));
		expect(ids).toEqual(['@m0:x', '@m1:x', '@m2:x', '@m3:x']);
	});

	describe('with a measured container', () => {
		let observe: ReturnType<typeof vi.fn>;
		let disconnect: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			observe = vi.fn();
			disconnect = vi.fn();
			vi.stubGlobal(
				'ResizeObserver',
				class {
					observe = observe;
					disconnect = disconnect;
					unobserve = vi.fn();
				}
			);
		});
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		const renderMeasured = (clientWidth: number, reservedWidth = 0) => {
			const element = document.createElement('div');
			Object.defineProperty(element, 'clientWidth', {
				value: clientWidth
			});
			const ref = { current: element };
			return render(
				<MemberAvatarStack
					members={members(27)}
					measureRef={ref}
					reservedWidth={reservedWidth}
					countLabel={(n) => `${n} more participants`}
				/>
			);
		};

		it('collapses everything into the chip when only the chip fits', () => {
			renderMeasured(AVATAR_STACK_METRICS.chipWidth);
			expect(screen.queryAllByTestId('user-avatar')).toHaveLength(0);
			expect(screen.getByText('+27')).toBeTruthy();
			expect(
				screen.getByRole('img', { name: '27 more participants' })
			).toBe(screen.getByTestId('member-avatar-overflow'));
		});

		it('subtracts the reserved sibling width', () => {
			const { avatarSize, overlap, chipWidth } = AVATAR_STACK_METRICS;
			const twoPlusChip =
				avatarSize + (avatarSize - overlap) + chipWidth - overlap;
			renderMeasured(twoPlusChip + 200, 200);
			expect(screen.getAllByTestId('user-avatar')).toHaveLength(2);
			expect(screen.getByText('+25')).toBeTruthy();
		});

		it('observes the container and disconnects on unmount', () => {
			const { unmount } = renderMeasured(1000);
			expect(observe).toHaveBeenCalledTimes(1);
			unmount();
			expect(disconnect).toHaveBeenCalledTimes(1);
		});
	});
});
