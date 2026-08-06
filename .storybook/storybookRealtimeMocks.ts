const storybookServiceHosts = new Set([
	'api.storybook.test',
	'auth.storybook.test',
	'matrix.storybook.test',
	'call.storybook.test',
	'livekit.storybook.test'
]);

const storybookLocalApiPrefixes = ['/api/', '/service/', '/p/api/'];

export const shouldMockStorybookRealtimeUrl = (
	url: string | URL,
	baseHref: string
): boolean => {
	try {
		const baseUrl = new URL(baseHref);
		const realtimeUrl = new URL(String(url), baseUrl);
		return (
			storybookServiceHosts.has(realtimeUrl.hostname) ||
			(realtimeUrl.host === baseUrl.host &&
				storybookLocalApiPrefixes.some((prefix) =>
					realtimeUrl.pathname.startsWith(prefix)
				))
		);
	} catch {
		return false;
	}
};

export class StorybookWebSocketMock extends EventTarget {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	binaryType: BinaryType = 'blob';
	bufferedAmount = 0;
	extensions = '';
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onopen: ((event: Event) => void) | null = null;
	protocol = '';
	readyState = StorybookWebSocketMock.CONNECTING;
	url: string;

	constructor(url: string | URL) {
		super();
		this.url = String(url);
		globalThis.setTimeout(() => {
			if (this.readyState !== StorybookWebSocketMock.CONNECTING) {
				return;
			}
			this.readyState = StorybookWebSocketMock.OPEN;
			const event = new Event('open');
			this.onopen?.(event);
			this.dispatchEvent(event);
		}, 0);
	}

	close() {
		if (this.readyState === StorybookWebSocketMock.CLOSED) {
			return;
		}
		this.readyState = StorybookWebSocketMock.CLOSED;
		const event = new CloseEvent('close', { code: 1000 });
		this.onclose?.(event);
		this.dispatchEvent(event);
	}

	send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {}
}
