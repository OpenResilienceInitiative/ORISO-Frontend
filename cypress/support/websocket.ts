import { WebSocket, Server, Client } from 'mock-socket';

// Rocket.Chat is gone (Matrix-only migration): this mock now only covers the
// remaining LiveService STOMP websocket. Matrix real-time traffic runs over
// HTTP long-polling (/_matrix sync) and is stubbed via cy.intercept instead.
declare global {
	interface Window {
		mockStompServer: Server;
		mockStompSocket: WebSocket;
		clipboardData: any;
		externalApi: any;
		JitsiMeetExternalAPI: any;
	}
}

let mockSocketServer = null;

export const closeWebSocketServer = () => {
	if (mockSocketServer) {
		mockSocketServer.close();
		mockSocketServer = null;
	}
};

export type ExtendedClient = Client & {
	type?: 'Stomp';
};

let subscriptions = {};

export const startWebSocketServer = () => {
	closeWebSocketServer();

	const mockStompURL = Cypress.env('CYPRESS_WS_URL')
		.replace('http://', 'ws://')
		.replace('https://', 'wss://');

	mockSocketServer = new Server(mockStompURL, {
		mock: true
	});

	mockSocketServer.on('connection', (socket: ExtendedClient) => {
		const pathname = new URL(socket.url).searchParams.get('pathname');

		if (pathname.startsWith('/service/live')) {
			socket.type = 'Stomp';
			socket.on('message', (message) => {
				const parsedMessage = JSON.parse(message.toString())[0].split(
					'\n'
				);

				if (parsedMessage[0] === 'CONNECT') {
					socket.send(
						'a["CONNECTED\\nversion:1.2\\nheart-beat:1200000,1200000\\n\\n\\u0000"]'
					);
				} else if (parsedMessage[0] === 'SUBSCRIBE') {
					subscriptions[parsedMessage[2].split(':')[1]] = null;
				}
			});

			socket.send('o');
		}
	});
};

export const mockWebSocket = () => {
	cy.wrap({
		get: () => subscriptions,
		set: (subs) => (subscriptions = subs)
	}).as('mockSocketServerSubscriptions');

	cy.wrap(() => mockSocketServer).as('mockSocketServer');

	cy.on('window:before:load', (win) => {
		const originWebsocket = win.WebSocket;
		cy.stub(win, 'WebSocket').callsFake((url) => {
			const pathname = new URL(url).pathname;

			if (pathname.startsWith('/service/live')) {
				const socket = new WebSocket(
					Cypress.env('CYPRESS_WS_URL')
						.replace('http://', 'ws://')
						.replace('https://', 'wss://') +
						'?pathname=' +
						pathname
				);

				socket.addEventListener('open', () => {
					if (socket?.readyState === 1) {
						win.document
							.getElementsByTagName('body')[0]
							.classList.add(`cy-socket-connected-stomp`);
					}
				});

				socket.onclose = () => {
					win.document
						.getElementsByTagName('body')[0]
						.classList.remove(`cy-socket-connected-stomp`);
				};

				socket.onerror = () => {
					win.document
						.getElementsByTagName('body')[0]
						.classList.remove(`cy-socket-connected-stomp`);
				};

				return socket;
			}
			//WDS_SOCKET_PORT
			return new originWebsocket(url);
		});
	});
};
