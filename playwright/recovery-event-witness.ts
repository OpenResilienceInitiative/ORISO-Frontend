import type { Page, Response } from '@playwright/test';

export interface EncryptedSendReceipt {
	eventId: string;
	homeserverOrigin: string;
	roomId: string;
	sessionId: string;
}

const isEventId = (id: unknown): id is string =>
	typeof id === 'string' && /^\$[^\s]+$/.test(id);

export async function readEncryptedSendReceipt(
	response: Response
): Promise<EncryptedSendReceipt | null> {
	if (!response.ok() || response.request().method() !== 'PUT') return null;
	try {
		const url = new URL(response.url());
		const send = url.pathname.match(
			/\/_matrix\/client\/v3\/rooms\/([^/]+)\/send\/m\.room\.encrypted\/[^/]+$/
		);
		if (!send) return null;
		const roomId = decodeURIComponent(send[1]);
		if (!roomId.startsWith('!')) return null;
		const request = response.request().postDataJSON();
		if (request?.algorithm !== 'm.megolm.v1.aes-sha2') return null;
		const { ciphertext, session_id: sessionId } = request;
		if (typeof ciphertext !== 'string' || !ciphertext.trim()) return null;
		if (typeof sessionId !== 'string' || !sessionId.trim()) return null;
		const eventId: unknown = (await response.json())?.event_id;
		if (!isEventId(eventId)) return null;
		return { eventId, homeserverOrigin: url.origin, roomId, sessionId };
	} catch {
		// The caller reports a missing witness without logging response content.
		return null;
	}
}

export async function hasExactRecoveryEvent(
	page: Page,
	eventId: string,
	marker: string
): Promise<boolean> {
	if (!isEventId(eventId) || !marker) return false;
	try {
		const row = page.locator(
			`#session-scroll-container [data-message-id=${JSON.stringify(eventId)}]`
		);
		if ((await row.count()) !== 1) return false;
		// MessageHtml renders the body here. Reply previews and author text sit outside it.
		return await row
			.locator('.messageItem__message > span:not([class])')
			.filter({ visible: true })
			.evaluateAll(
				(nodes, expected) =>
					nodes.length === 1 &&
					nodes[0] instanceof HTMLElement &&
					nodes[0].innerText.trim() === expected,
				marker
			);
	} catch {
		return false;
	}
}
