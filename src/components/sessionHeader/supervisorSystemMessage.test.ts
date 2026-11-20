import { describe, expect, it } from 'vite-plus/test';
import { buildSupervisorSystemMessagePayload } from './supervisorSystemMessage';

const translate = (key: string, options?: Record<string, unknown>) =>
	options?.name ? `${key}|${options.name}` : key;

describe('supervisor system message (OBP 2.1 #119)', () => {
	it('announces an added supervisor', () => {
		expect(
			JSON.parse(
				buildSupervisorSystemMessagePayload('added', 'Ada', translate)
			)
		).toEqual({
			title: 'message.supervisionEnabledTitle',
			description: 'message.supervisionEnabledDescription|Ada'
		});
	});

	it('announces a removed supervisor', () => {
		expect(
			JSON.parse(
				buildSupervisorSystemMessagePayload('removed', 'Ada', translate)
			)
		).toEqual({
			title: 'message.supervisionDisabledTitle',
			description: 'message.supervisionDisabledDescription|Ada'
		});
	});
});
