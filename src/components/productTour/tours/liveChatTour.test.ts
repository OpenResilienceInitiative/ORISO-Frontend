import { describe, expect, it } from 'vite-plus/test';
import { getAvailableTours } from '../tourCatalogue';
import { frontendTopicTours } from '../tourDefinitions';
import { consultantLiveChatTour, LIVE_CHAT_TOUR_VERSION } from './liveChatTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

describe('consultant-live-chat', () => {
	itKeepsTheTourContract(
		consultantLiveChatTour,
		'consultant',
		LIVE_CHAT_TOUR_VERSION
	);

	it('walks settings → rail toggle → queue → accept, centred at both ends', () => {
		expect(consultantLiveChatTour.steps.map((step) => step.id)).toEqual([
			'intro',
			'availability-settings',
			'availability-toggle',
			'queue',
			'accept',
			'done'
		]);
		expect(consultantLiveChatTour.steps[0].target).toBe('');
		expect(consultantLiveChatTour.steps.at(-1)?.target).toBe('');
	});

	it('makes only the content-dependent steps optional', () => {
		expect(
			consultantLiveChatTour.steps
				.filter((step) => step.optional)
				.map((step) => step.id)
		).toEqual(['availability-toggle', 'queue', 'accept']);
	});

	it('anchors the queue on the live-chat filter chip', () => {
		const queue = consultantLiveChatTour.steps.find(
			(step) => step.id === 'queue'
		);
		expect(queue?.target).toBe('livechat-queue');
		expect(queue?.route).toBe('/sessions/consultant/sessionPreview');
	});

	it('is offered only while anonymous live chat is on', () => {
		expect(
			getAvailableTours([consultantLiveChatTour], 'consultant', {
				flags: {}
			})
		).toEqual([consultantLiveChatTour]);
		expect(
			getAvailableTours([consultantLiveChatTour], 'consultant', {
				flags: { featureAnonymousChatEnabled: false }
			})
		).toEqual([]);
		expect(
			getAvailableTours([consultantLiveChatTour], 'asker', { flags: {} })
		).toEqual([]);
	});

	it('is registered as a topic tour', () => {
		expect(frontendTopicTours).toContain(consultantLiveChatTour);
	});
});
