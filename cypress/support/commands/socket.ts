import { v4 as uuid } from 'uuid';
import { Server } from 'mock-socket';
import { ExtendedClient } from '../websocket';

const waitForSubscriptions = (getSubscriptions, events: string[]) => {
	let subscribed = true;
	events.forEach((event) => {
		if (!getSubscriptions().hasOwnProperty(event)) {
			subscribed = false;
		}
	});

	if (!subscribed) {
		setTimeout(() => {
			waitForSubscriptions(getSubscriptions, events);
		}, 250);
	}
};

Cypress.Commands.add('waitForSubscriptions', (events: string[]) => {
	cy.get<any>('@mockSocketServerSubscriptions').then(
		({ get: getSubscriptions }) => {
			waitForSubscriptions(getSubscriptions, events);
		}
	);
});

Cypress.Commands.add('emitDirectMessage', (index?: number) => {
	new Cypress.Promise((resolve) => {
		cy.askerSession({ session: { messagesRead: false } }, index || 0);
		cy.addMessage({}, index || 0);

		cy.get<() => Server>('@mockSocketServer').then((mockSocketServer) => {
			// Rocket.Chat is gone (Matrix-only migration): only the
			// LiveService STOMP event remains for direct messages.
			mockSocketServer()
				.clients()
				.forEach((client: ExtendedClient) => {
					if (client.type === 'Stomp') {
						client.send(
							`a["MESSAGE\\ndestination:/user/events\\ncontent-type:application/json\\nsubscription:sub-0\\nmessage-id:${uuid()}\\ncontent-length:29\\n\\n{\\"eventType\\":\\"directMessage\\"}\\u0000"]`
						);
					}
				});

			resolve();
		});
	});
});
