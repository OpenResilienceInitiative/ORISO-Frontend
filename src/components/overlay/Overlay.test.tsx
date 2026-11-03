// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { Overlay } from './Overlay';
import { ModalProvider } from '../../globalState/provider/ModalProvider';

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
