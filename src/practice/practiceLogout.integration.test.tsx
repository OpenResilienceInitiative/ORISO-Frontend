// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teardownLocalSession } from '../components/logout/logout';
import { MatrixClientService } from '../services/matrixClientService';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../services/matrixClientRegistry';
import { endpoints } from '../resources/scripts/endpoints';
import { PracticeSandbox } from './PracticeSandbox';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import { enterPracticeMode, exitPracticeMode } from './practiceMode';
import { PRACTICE_MAIN_ROOM_ID } from './practiceIds';
import { createTestScript } from './script/scriptTestSupport';

const settle = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
let pageFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
	pageFetch = vi.fn(async () => new Response(null, { status: 204 }));
	window.fetch = pageFetch;
});

afterEach(async () => {
	cleanup();
	await settle();
	exitPracticeMode();
	setMatrixClientServiceRef(null);
	vi.restoreAllMocks();
});

describe('session expiry during practice', () => {
	it('synchronously logs out the real Matrix service and keeps pending practice cleanup isolated', async () => {
		const service = new MatrixClientService();
		const logout = vi.spyOn(service, 'logout');
		setMatrixClientServiceRef(service);
		enterPracticeMode({ tourId: 'consultant-practice-accept' });
		const view = render(
			<PracticeSandbox
				counsellor={practiceCounsellorFixture()}
				script={createTestScript()}
			>
				{null}
			</PracticeSandbox>
		);
		let finishBody = () => undefined as void;
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				finishBody = () => {
					controller.enqueue(
						new TextEncoder().encode(
							JSON.stringify({
								roomId: PRACTICE_MAIN_ROOM_ID,
								active: false
							})
						)
					);
					controller.close();
				};
			}
		});
		const pendingCleanup = window.fetch(
			new Request(`${endpoints.eventNotifications}/active-view`, {
				method: 'PATCH',
				body,
				duplex: 'half'
			} as RequestInit)
		);

		act(() => teardownLocalSession());
		// Auth must be torn down before the login form can render, even if
		// practice views and a fake request still exist in this same turn.
		expect(logout).toHaveBeenCalledOnce();
		expect(getMatrixClientService()).toBeNull();

		view.unmount();
		finishBody();
		expect((await pendingCleanup).status).toBe(204);
		await settle();
		expect(pageFetch).not.toHaveBeenCalled();
		expect(getMatrixClientService()).toBeNull();
	});
});
