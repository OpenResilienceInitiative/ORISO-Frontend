// @vitest-environment oriso-jsdom
import * as React from 'react';
import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

import { ModalContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import { Overlay } from './Overlay';

vi.mock('focus-trap-react', () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

let showFailure: () => void = () => undefined;
const Harness = () => {
	const [failed, setFailed] = React.useState(false);
	showFailure = () => setFailed(true);
	return (
		<>
			<output>{failed ? 'state: failed' : 'state: saved'}</output>
			<Overlay
				item={{
					headline: 'saved',
					nestedComponent: failed ? (
						<p role="alert">refresh failed</p>
					) : undefined
				}}
			/>
		</>
	);
};

it('shows a changed item in the same commit that renders it', async () => {
	document.body.innerHTML = '<div id="overlay"></div>';
	render(
		<ModalProvider>
			<Harness />
		</ModalProvider>
	);
	await act(async () => undefined);
	expect(screen.getByText('saved')).toBeTruthy();
	const overlay = document.getElementById('overlay')!;
	// Record the overlay as it is at the commit that renders the change, before
	// React runs that commit's passive effects.
	const firstCommit = new Promise<string>((resolve) => {
		const observer = new MutationObserver(() => {
			observer.disconnect();
			resolve(overlay.textContent ?? '');
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true
		});
	});
	await Promise.resolve().then(showFailure);
	expect(await firstCommit).toContain('refresh failed');
});

const Modals = ({ children }: { children: React.ReactNode }) => {
	const [overlays, setOverlays] = useState<{ id: string }[]>([]);
	const [value] = useState(() => ({
		addOverlay: (overlay) => setOverlays((all) => [...all, overlay]),
		removeOverlay: (id) =>
			setOverlays((all) => all.filter((overlay) => overlay.id !== id))
	}));
	return (
		<ModalContext.Provider value={{ ...value, overlays } as never}>
			{children}
		</ModalContext.Provider>
	);
};

const Screen = ({ dialogOpen }: { dialogOpen: boolean }) => (
	<Modals>
		<M3Snackbar message="Standing" testId="standing" yieldToOthers />
		{dialogOpen && (
			<Overlay item={{ headline: 'End this anonymous chat?' }} />
		)}
	</Modals>
);

describe('Overlay', () => {
	beforeEach(() => {
		const root = document.createElement('div');
		root.id = 'overlay';
		document.body.appendChild(root);
	});

	afterEach(() => {
		cleanup();
		document.getElementById('overlay')?.remove();
	});

	// A standing notice sits above the dialog and swallows clicks on its buttons.
	it('makes a standing notice step aside until the dialog closes', async () => {
		const { rerender } = render(<Screen dialogOpen={false} />);
		expect(screen.getByTestId('standing')).toBeTruthy();

		rerender(<Screen dialogOpen />);
		expect(
			await screen.findByText('End this anonymous chat?')
		).toBeTruthy();
		await waitFor(() =>
			expect(screen.queryByTestId('standing')).toBeNull()
		);

		rerender(<Screen dialogOpen={false} />);
		expect(await screen.findByTestId('standing')).toBeTruthy();
	});
});
