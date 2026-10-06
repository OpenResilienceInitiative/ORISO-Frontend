// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsContext } from '../../globalState';
import {
	IncomingVideoCall,
	IncomingVideoCallProps,
	NOTIFICATION_TYPE_CALL
} from './IncomingVideoCall';

const REJECT_LABEL = 'Video-Call ablehnen';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			key === 'videoCall.button.rejectCall' ? REJECT_LABEL : key
	})
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
/* The Button component pulls in the lottie player; jsdom has no canvas. */
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-device-detect', () => ({ isMobile: false }));
/* The close control only exists where the browser cannot join an encrypted
   call — the case these tests are about. */
vi.mock('../../utils/videoCallHelpers', () => ({
	supportsE2EEncryptionVideoCall: () => false
}));
const call = vi.hoisted(() => ({ roomId: '!room:test', reject: vi.fn() }));
vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({
		matrixClientService: {
			getClient: () => ({
				callEventHandler: { calls: new Map([['c1', call]]) }
			})
		}
	})
}));

const removeNotification = vi.fn();
const props = {
	notificationType: NOTIFICATION_TYPE_CALL,
	id: '!room:test',
	videoCall: {
		matrixRoomId: '!room:test',
		initiatorMatrixUserId: '@counsellor:test',
		initiatorUsername: 'Beraterin',
		videoCallUrl: 'https://call.test'
	}
} as unknown as IncomingVideoCallProps;

const renderCall = () =>
	render(
		<NotificationsContext.Provider value={{ removeNotification } as never}>
			<IncomingVideoCall {...props} />
		</NotificationsContext.Provider>
	);

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('IncomingVideoCall — the reject control in the header', () => {
	/* It was a <div onClick>: no role, no tab stop, no key handler — a
	   keyboard-only counsellor could not turn the call down. It rejects the
	   call, so it is named for that, not "close". */
	it('is a button named for what it does', () => {
		renderCall();

		const reject = screen.getByRole('button', { name: REJECT_LABEL });
		expect(reject.getAttribute('type')).toBe('button');
	});

	it('rejects the call from the keyboard with Enter', async () => {
		const user = userEvent.setup();
		renderCall();

		await user.tab();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: REJECT_LABEL })
		);
		await user.keyboard('{Enter}');

		expect(call.reject).toHaveBeenCalledTimes(1);
		expect(removeNotification).toHaveBeenCalledWith(
			'!room:test',
			NOTIFICATION_TYPE_CALL
		);
	});

	it('rejects the call from the keyboard with Space', async () => {
		const user = userEvent.setup();
		renderCall();

		await user.tab();
		/* The first tab stop must be this control — the help button below also
		   rejects the call, so pressing Space anywhere would prove nothing. */
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: REJECT_LABEL })
		);
		await user.keyboard(' ');

		expect(call.reject).toHaveBeenCalledTimes(1);
	});

	it('still rejects the call on click, as before', async () => {
		const user = userEvent.setup();
		renderCall();

		await user.click(screen.getByRole('button', { name: REJECT_LABEL }));

		expect(call.reject).toHaveBeenCalledTimes(1);
		expect(removeNotification).toHaveBeenCalledTimes(1);
	});
});
