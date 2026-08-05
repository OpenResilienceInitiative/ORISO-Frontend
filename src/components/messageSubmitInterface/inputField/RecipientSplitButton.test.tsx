// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecipientSplitButton } from './RecipientSplitButton';

const renderButton = (
	props: Partial<React.ComponentProps<typeof RecipientSplitButton>> = {}
) =>
	render(
		<RecipientSplitButton
			label="Alle"
			icon={<svg data-testid="icon" />}
			isOpen={false}
			onToggle={vi.fn()}
			chevronLabel="Open send-to menu"
			{...props}
		/>
	);

// `globals` is off in this project, so RTL never registers its own teardown.
afterEach(() => cleanup());

/** This project has no jest-dom matchers, so assert on the class list itself. */
const chipClasses = (container: HTMLElement) =>
	Array.from((container.firstChild as HTMLElement).classList);

describe('RecipientSplitButton', () => {
	/**
	 * #894 rule B. The grey "everyone" treatment existed only as CSS on
	 * `.textarea__audienceSelectorMain` / `…Chevron` — class names this
	 * component never renders. The chip was therefore always in the red
	 * "targeted" colour, including when the message went to everybody, which
	 * inverts the one signal the control is there to give.
	 */
	it('renders the neutral variant when the message goes to everyone', () => {
		const { container } = renderButton({ variant: 'all' });
		expect(chipClasses(container)).toContain('recipientSplitButton--all');
	});

	it('renders the targeted variant when recipients are restricted', () => {
		const { container } = renderButton({
			variant: 'targeted',
			label: 'K. Paulstätter'
		});
		expect(chipClasses(container)).toContain('recipientSplitButton--targeted');
		expect(chipClasses(container)).not.toContain('recipientSplitButton--all');
	});

	it('treats a missing variant as targeted, the safer signal', () => {
		const { container } = renderButton();
		expect(chipClasses(container)).toContain('recipientSplitButton--targeted');
	});

	it('exposes both halves as one labelled control', () => {
		const { getByRole, getByText } = renderButton({ variant: 'all' });
		expect(getByRole('button', { name: 'Open send-to menu' })).toBeTruthy();
		expect(getByText('Alle')).toBeTruthy();
	});
});
