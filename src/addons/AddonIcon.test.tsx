// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { AddonIcon, addonIconUrl, resetAddonIconsForTests } from './AddonIcon';

vi.mock('../resources/img/icons/tools_outline.svg', () => ({
	ReactComponent: (props: { className?: string }) => (
		<svg data-testid="default-icon" className={props.className} />
	)
}));

const images: { src: string; onload?: () => void; onerror?: () => void }[] = [];

class FakeImage {
	src = '';
	onload?: () => void;
	onerror?: () => void;
	constructor() {
		images.push(this);
	}
}

describe('AddonIcon', () => {
	afterEach(() => {
		cleanup();
		images.length = 0;
		resetAddonIconsForTests();
		vi.unstubAllGlobals();
	});

	it('takes only SVGs from an add-on UI route', () => {
		expect(
			addonIconUrl('/service/addons/tools/ui/icons/goals.svg', '')
		).toBe('/service/addons/tools/ui/icons/goals.svg');
		expect(
			addonIconUrl('/service/addons/tools/ui/goals.svg', 'https://a')
		).toBe('https://a/service/addons/tools/ui/goals.svg');
		for (const icon of [
			undefined,
			'',
			'https://evil.example/x.svg',
			'//evil.example/service/addons/t/ui/x.svg',
			'/service/addons/tools/ui/../../x.svg',
			'/service/addons/tools/api/x.svg',
			'/service/addons/tools/ui/x.png',
			'/service/addons/tools/ui/x.svg") ; background: url("y',
			'/service/addons/tools/ui//x.svg'
		]) {
			expect(addonIconUrl(icon, '')).toBeNull();
		}
	});

	it('draws the icon as a mask in the text colour', () => {
		vi.stubGlobal('Image', FakeImage);
		const { container } = render(
			<AddonIcon
				icon="/service/addons/tools/ui/icons/goals.svg"
				className="x"
			/>
		);

		const icon = container.querySelector('.addonIcon') as HTMLElement;
		expect(icon.classList.contains('x')).toBe(true);
		expect(icon.getAttribute('aria-hidden')).toBe('true');
		expect(icon.style.getPropertyValue('--addon-icon')).toContain(
			'/service/addons/tools/ui/icons/goals.svg'
		);
	});

	it('falls back to the default icon without one or when it does not load', () => {
		vi.stubGlobal('Image', FakeImage);
		const without = render(<AddonIcon />);
		expect(without.getByTestId('default-icon')).toBeTruthy();
		without.unmount();

		const view = render(
			<AddonIcon icon="/service/addons/tools/ui/icons/missing.svg" />
		);
		expect(view.queryByTestId('default-icon')).toBeNull();
		act(() => images[0].onerror?.());
		expect(view.getByTestId('default-icon')).toBeTruthy();
	});
});
