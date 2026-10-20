// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import {
	buildMockGroupSession,
	ComposerStoryDecorator,
	mockComposerUserData
} from './__storybook__/composerStoryDecorator';
import { SessionTypeContext } from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import en from '../../resources/i18n/en/common.json';
import { chatTransportService } from '../../services/chatTransportService';

// Browser drawing is outside the recipient/hydration contract.
vi.hoisted(() => {
	Object.defineProperty(document, 'elementFromPoint', {
		configurable: true,
		value: () => null
	});
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () =>
			new Proxy(
				{},
				{
					get: (_target, key) =>
						key === 'measureText' ? () => ({ width: 0 }) : () => {}
				}
			)
	});
});

vi.mock('../../api/apiPostError', async (original) => ({
	...(await original<typeof import('../../api/apiPostError')>()),
	apiPostError: async () => ({})
}));

vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({ ready: true, encryptRoom: async () => {} })
}));

const i18n = createInstance().use(initReactI18next);
const session = buildMockGroupSession();
session.user.username = 'group-chat-system-40';
session.item.askerMatrixUserId = '@group-chat-system-40:predev.oriso.org';
session.consultant = { username: 'bart', displayName: 'Bart' };
const userData = {
	...mockComposerUserData,
	userName: 'bart',
	displayName: 'Bart'
};
const homer = { userId: '@homer:predev.oriso.org', name: 'Homer' };
const marge = { userId: '@marge:predev.oriso.org', name: 'Marge' };
const system = {
	userId: '@group-chat-system-40:predev.oriso.org',
	name: 'group-chat-system-40'
};

function Composer({ members }: { members: (typeof homer)[] }) {
	return (
		<I18nextProvider i18n={i18n}>
			<MemoryRouter>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions'
					}}
				>
					<ComposerStoryDecorator
						activeSession={session}
						userData={userData}
						roomMembers={members}
					>
						<MessageSubmitInterfaceComponent
							autoFocusEditor={false}
							placeholder="Synthetic message"
						/>
					</ComposerStoryDecorator>
				</SessionTypeContext.Provider>
			</MemoryRouter>
		</I18nextProvider>
	);
}

beforeEach(async () => {
	localStorage.clear();
	vi.restoreAllMocks();
	await i18n.init({
		lng: 'en',
		fallbackLng: false,
		resources: { en: { translation: en } }
	});
});
afterEach(() => {
	cleanup();
	localStorage.clear();
});

async function sendPrivateDraft() {
	const editor = screen.getByRole('textbox');
	const user = userEvent.setup();
	await user.click(editor);
	await user.type(editor, 'Synthetic private draft');
	await user.click(
		screen.getByRole('button', {
			name: i18n.t('enquiry.write.input.button.title')
		})
	);
	return editor;
}

async function chooseHomer() {
	fireEvent.click(
		await screen.findByRole('button', {
			name: i18n.t('message.audience.all')
		})
	);
	fireEvent.click(screen.getByRole('button', { name: 'Homer' }));
	fireEvent.click(
		screen.getByRole('button', {
			name: i18n.t('message.audience.closeMenu')
		})
	);
}

it.each([false, true])(
	'does not broaden a deliberate human audience when membership shrinks and returns (restoreFull=%s)',
	async (restoreFull) => {
		const send = vi.spyOn(chatTransportService, 'sendTextMessage');
		const view = render(<Composer members={[system, homer, marge]} />);
		await chooseHomer();
		view.rerender(<Composer members={[system, homer]} />);
		if (restoreFull)
			view.rerender(<Composer members={[system, homer, marge]} />);
		const editor = await sendPrivateDraft();
		await screen.findByRole('alert');
		expect(send).not.toHaveBeenCalled();
		expect(editor.textContent).toBe('Synthetic private draft');
		expect(localStorage.getItem('oriso.audienceSelection.9001')).toBe(
			JSON.stringify([homer.userId])
		);
	}
);

it.each([homer.userId, marge.userId])(
	'preserves a stored human restriction before all members have loaded: %s',
	async (recipient) => {
		const send = vi.spyOn(chatTransportService, 'sendTextMessage');
		localStorage.setItem(
			'oriso.audienceSelection.9001',
			JSON.stringify([recipient])
		);
		const writes = vi.spyOn(Storage.prototype, 'setItem');
		const view = render(<Composer members={[]} />);
		view.rerender(<Composer members={[system, homer]} />);
		view.rerender(<Composer members={[system, homer, marge]} />);
		const editor = await sendPrivateDraft();
		await screen.findByRole('alert');
		expect(send).not.toHaveBeenCalled();
		expect(editor.textContent).toBe('Synthetic private draft');
		expect(localStorage.getItem('oriso.audienceSelection.9001')).toBe(
			JSON.stringify([recipient])
		);
		expect(
			writes.mock.calls
				.filter(([key]) => key === 'oriso.audienceSelection.9001')
				.every(([, value]) => value === JSON.stringify([recipient]))
		).toBe(true);
	}
);

it('blocks a stored technical target until Everyone is deliberately chosen without offering the technical account', async () => {
	const send = vi
		.spyOn(chatTransportService, 'sendTextMessage')
		.mockResolvedValue({ event_id: '$synthetic' });
	localStorage.setItem(
		'oriso.audienceSelection.9001',
		JSON.stringify(['group-chat-system-40'])
	);
	render(<Composer members={[system, homer, marge]} />);
	const editor = await sendPrivateDraft();
	await screen.findByRole('alert');
	expect(send).not.toHaveBeenCalled();
	expect(editor.textContent).toBe('Synthetic private draft');
	fireEvent.click(
		screen.getByRole('button', {
			name: i18n.t('message.audience.menuHeading')
		})
	);
	expect(screen.queryByText('group-chat-system-40')).toBeNull();
	fireEvent.click(
		screen.getByRole('button', {
			name: i18n.t('message.audience.selectAllBottom')
		})
	);
	await userEvent.setup().click(
		screen.getByRole('button', {
			name: i18n.t('enquiry.write.input.button.title')
		})
	);
	await waitFor(() => expect(send).toHaveBeenCalledOnce());
	expect(send.mock.calls[0][0].matrixRoomId).toBe(
		'!storybook-group:example.org'
	);
});

it('keeps Everyone through a reload with only a technical owner before the human roster arrives (#1805)', async () => {
	localStorage.setItem(
		'oriso.audienceSelection.9001',
		JSON.stringify(['__all__'])
	);
	const view = render(<Composer members={[]} />);
	view.rerender(<Composer members={[system, homer]} />);
	// A two-person room has no audience restriction to choose.
	expect(
		screen.queryByRole('button', { name: i18n.t('message.audience.all') })
	).toBeNull();
	view.rerender(<Composer members={[system, homer, marge]} />);
	const everyone = await screen.findByRole('button', {
		name: i18n.t('message.audience.all')
	});
	await waitFor(() =>
		expect(localStorage.getItem('oriso.audienceSelection.9001')).toBe(
			'["__all__"]'
		)
	);
	fireEvent.click(everyone);
	expect(screen.queryByText('group-chat-system-40')).toBeNull();
	expect(screen.getByRole('button', { name: 'Homer' })).toBeTruthy();
	expect(screen.getByRole('button', { name: 'Marge' })).toBeTruthy();
});

it('reports an unsupported narrowed send as a message failure, retains the draft and never falls back to the main room', async () => {
	const send = vi.spyOn(chatTransportService, 'sendTextMessage');
	render(<Composer members={[system, homer, marge]} />);
	fireEvent.click(
		await screen.findByRole('button', {
			name: i18n.t('message.audience.all')
		})
	);
	fireEvent.click(screen.getByRole('button', { name: 'Homer' }));
	fireEvent.click(
		screen.getByRole('button', {
			name: i18n.t('message.audience.closeMenu')
		})
	);
	const editor = screen.getByRole('textbox');
	const user = userEvent.setup();
	await user.click(editor);
	await user.type(editor, 'Synthetic private draft');
	await user.click(
		screen.getByRole('button', {
			name: i18n.t('enquiry.write.input.button.title')
		})
	);
	const alert = await screen.findByRole('alert');
	expect(alert.textContent).toContain(i18n.t('statusOverlay.error.headline'));
	expect(alert.textContent).not.toContain(
		i18n.t('attachments.error.other.headline')
	);
	expect(editor.textContent).toBe('Synthetic private draft');
	expect(send).not.toHaveBeenCalled();
});
