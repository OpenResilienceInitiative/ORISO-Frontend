// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The globalState barrel drags in i18n/DevToolbar (module-load localStorage);
// the Overlay only needs the ModalContext from it — re-export the real one so
// provider and consumers share the same context instance.
vi.mock('../../../globalState', async () => ({
	ModalContext: (await import('../../../globalState/context/ModalContext'))
		.ModalContext
}));
// ModalProvider reads the app config through this hook (barrel import again);
// it only optional-chains into it, so null is a faithful stand-in.
vi.mock('../../../hooks/useAppConfig', () => ({
	useAppConfig: () => null
}));
// Overlay renders translated copy via react-i18next; the toolbar itself
// receives `translate` as a prop, so a key-echo stub is enough here.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
// Raw SVG imports need the webpack svgr loader; stub them for vitest.
vi.mock('../../../resources/img/icons/x.svg', () => ({
	ReactComponent: (props: any) => <svg aria-hidden="true" {...props} />
}));
vi.mock('../../../resources/img/icons/reload.svg', () => ({
	ReactComponent: (props: any) => <svg aria-hidden="true" {...props} />
}));

// eslint-disable-next-line import/first
import { ModalProvider } from '../../../globalState/provider/ModalProvider';
// eslint-disable-next-line import/first
import { Overlay } from '../../overlay/Overlay';
// eslint-disable-next-line import/first
import { ComposerToolbar } from './ComposerToolbar';

const noop = () => {};
const translate = ((key: string, fallback?: string) => fallback ?? key) as any;

/**
 * Regression test for issue #458: the composer's floating toolbar menus are
 * portalled to document.body, so when the "chat ended" overlay took over the
 * view (the composer stays mounted underneath), an open Bullet/Ordered/Task
 * List menu survived as a DOM leftover on top of the overlay. The toolbar must
 * close its menus as soon as any overlay registers itself in the ModalContext.
 */
const harness = (chatEndedOverlayOpen: boolean) => (
	<ModalProvider>
		<ComposerToolbar
			direction="up"
			isMobile={false}
			isExpanded={false}
			onAction={noop}
			isActionSelected={() => false}
			onCollapse={noop}
			onExpandToggle={noop}
			translate={translate}
		/>
		{chatEndedOverlayOpen && (
			<Overlay
				item={{ headline: 'groupChat.stopped.overlay.headline' }}
				handleOverlay={noop}
			/>
		)}
	</ModalProvider>
);

afterEach(() => cleanup());

describe('ComposerToolbar floating menus during overlay transitions', () => {
	it('closes an open list menu when the chat-ended overlay opens', () => {
		const view = render(harness(false));

		fireEvent.click(screen.getByRole('button', { name: 'List style' }));
		expect(screen.getByRole('menu', { name: 'List style' })).toBeTruthy();
		expect(
			screen.getByRole('menuitem', { name: /Bullet List/ })
		).toBeTruthy();

		// The chat-ended overlay appears (trigger-independent: any Overlay
		// registering itself in the ModalContext must clear the menu).
		view.rerender(harness(true));

		expect(screen.queryByRole('menu')).toBeNull();
		expect(screen.queryByRole('menuitem')).toBeNull();
	});

	it('keeps the menu toggle working while no overlay is active', () => {
		render(harness(false));

		fireEvent.click(screen.getByRole('button', { name: 'List style' }));
		expect(screen.getByRole('menu', { name: 'List style' })).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'List style' }));
		expect(screen.queryByRole('menu')).toBeNull();
	});
});
