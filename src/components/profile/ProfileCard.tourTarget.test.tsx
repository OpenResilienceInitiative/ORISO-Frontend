// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cleanup, render, screen } from '@testing-library/react';
import { ProfileCardList } from './ProfileCardList';

afterEach(cleanup);

const Body = () => <p>Inhalt</p>;
const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;

describe('ProfileCard — product-tour anchor', () => {
	it('puts the route element tourTarget on the boxed card', () => {
		render(
			<ProfileCardList
				elements={[
					{
						component: Body,
						icon: Icon,
						tourTarget: 'profile-display'
					}
				]}
			/>
		);

		expect(
			screen.getByTestId('profile-card').getAttribute('data-tour-target')
		).toBe('profile-display');
	});

	it('puts it on the bare card too (unboxed sections)', () => {
		const { container } = render(
			<ProfileCardList
				elements={[
					{
						component: Body,
						boxed: false,
						tourTarget: 'profile-security'
					}
				]}
			/>
		);

		expect(
			container
				.querySelector('.profile__card--bare')
				?.getAttribute('data-tour-target')
		).toBe('profile-security');
	});

	it('renders no anchor attribute without the prop', () => {
		const { container } = render(
			<ProfileCardList elements={[{ component: Body, icon: Icon }]} />
		);

		expect(container.querySelector('[data-tour-target]')).toBeNull();
	});
});
