// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useDismissOnOutside } from './useDismissOnOutside';

afterEach(cleanup);

const Harness = ({ onDismiss }: { onDismiss: () => void }) => {
	const ref = React.useRef<HTMLDivElement | null>(null);
	useDismissOnOutside(ref, onDismiss);
	return (
		<div>
			<aside data-testid="list">
				<a href="#session" data-testid="session-link">
					session
				</a>
				<button type="button">Suche</button>
				<span data-testid="list-gap" />
			</aside>
			<div ref={ref} className="conversationCreate" data-testid="surface">
				<div className="conversationCreate__picker" data-testid="gap" />
				<section data-testid="card">
					<input aria-label="Name Interna" />
					<button type="button">Interna erstellen</button>
				</section>
			</div>
		</div>
	);
};

const click = (element: Element) => {
	fireEvent.pointerDown(element);
	fireEvent.mouseDown(element);
	fireEvent.pointerUp(element);
	fireEvent.click(element);
};

describe('useDismissOnOutside', () => {
	it('closes on a click into empty space inside the panel', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		click(screen.getByTestId('gap'));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('closes on a click into empty space outside the panel', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		click(screen.getByTestId('list-gap'));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('does not close when a card or its controls are clicked', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		click(screen.getByTestId('card'));
		click(screen.getByLabelText('Name Interna'));
		click(screen.getByRole('button', { name: 'Interna erstellen' }));
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('leaves buttons and links behind the panel to do their own job', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		click(screen.getByRole('button', { name: 'Suche' }));
		click(screen.getByTestId('session-link'));
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('closes on Escape', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		fireEvent.keyDown(document.body, { key: 'Escape' });
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('ignores Escape that an open menu or dialog already handled', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		const event = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true
		});
		event.preventDefault();
		document.body.dispatchEvent(event);
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('does not close while a menu or dialog is open', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		const menu = document.createElement('div');
		menu.className = 'rowMenu';
		document.body.appendChild(menu);
		click(screen.getByTestId('gap'));
		fireEvent.keyDown(document.body, { key: 'Escape' });
		menu.remove();
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('ignores a drag that starts in a card and ends on the backdrop', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		fireEvent.pointerDown(screen.getByTestId('card'));
		fireEvent.click(screen.getByTestId('gap'));
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('stops listening after unmount', () => {
		const onDismiss = vi.fn();
		const { unmount } = render(<Harness onDismiss={onDismiss} />);
		unmount();
		fireEvent.keyDown(document.body, { key: 'Escape' });
		expect(onDismiss).not.toHaveBeenCalled();
	});
});
