// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
	anonymousGateKeys,
	readAnonymousGateState
} from './anonymousGateStorage';

afterEach(() => sessionStorage.clear());

describe('anonymousGateStorage (#1824: the chat’s per-tab gate state, shared)', () => {
	it('names the keys the chat has always used', () => {
		expect(anonymousGateKeys(13)).toEqual({
			consent: 'anonymous-inquiry-consent-13',
			pseudonym: 'anonymous-pseudonym-13',
			waitingDismissed: 'anonymous-waiting-dismissed-13'
		});
	});

	it('reads nothing as false', () => {
		expect(readAnonymousGateState(13)).toEqual({
			consentAccepted: false,
			pseudonymConfirmed: false,
			waitingGateDismissed: false
		});
	});

	it('reads what the chat stored for this session only', () => {
		sessionStorage.setItem('anonymous-inquiry-consent-13', '1');
		sessionStorage.setItem('anonymous-pseudonym-13', '1');
		sessionStorage.setItem('anonymous-waiting-dismissed-14', '1');
		expect(readAnonymousGateState(13)).toEqual({
			consentAccepted: true,
			pseudonymConfirmed: true,
			waitingGateDismissed: false
		});
	});

	it('is false without a session id', () => {
		expect(readAnonymousGateState(undefined).pseudonymConfirmed).toBe(
			false
		);
	});
});
