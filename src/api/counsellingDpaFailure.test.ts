import { describe, expect, it } from 'vitest';
import { getCounsellingDpaFailure } from './counsellingDpaFailure';
import { getCounsellingDpaNotification } from '../utils/counsellingDpaNotification';
import de from '../resources/i18n/de/common.json';
import en from '../resources/i18n/en/common.json';
import fr from '../resources/i18n/fr/common.json';

describe('authoritative counselling failure explanations', () => {
	it.each([
		[403, 'DPA_NEW_COUNSELLING_NOT_ALLOWED', false],
		[502, 'DPA_POLICY_UNAVAILABLE', true]
	] as const)(
		'distinguishes confirmed refusal%s from a verification outage',
		(status, reason, retryable) => {
			const response = new Response('', {
				status,
				headers: { 'x-reason': reason }
			});
			expect(getCounsellingDpaFailure(response)?.retryable).toBe(
				retryable
			);
		}
	);

	it.each([
		[403, 'DPA_POLICY_UNAVAILABLE'],
		[502, 'DPA_NEW_COUNSELLING_NOT_ALLOWED'],
		[401, 'DPA_NEW_COUNSELLING_NOT_ALLOWED'],
		[403, 'OTHER_PERMISSION'],
		[502, '']
	])(
		'does not describe unrelated status%s or reasons as a legal restriction',
		(status, reason) => {
			expect(
				getCounsellingDpaFailure(
					new Response('', {
						status,
						headers: { 'X-Reason': reason }
					})
				)
			).toBeNull();
		}
	);

	it('does not convert ordinary errors into legal failures', () => {
		expect(
			getCounsellingDpaFailure(new Error('connection lost'))
		).toBeNull();
	});

	it.each([
		['de', de],
		['en', en],
		['fr', fr]
	] as const)(
		'has distinct readable restriction and retry copy in%s',
		(_, dictionary) => {
			const copy = dictionary.counselling.dpa;
			expect(copy.restricted.text).not.toEqual(copy.unavailable.text);
			expect(copy.restricted.title.length).toBeGreaterThan(10);
			expect(copy.unavailable.text.length).toBeGreaterThan(40);
		}
	);

	it('announces an existing closable notification without expiring before it can be read', () => {
		const response = new Response('', {
			status: 403,
			headers: { 'X-Reason': 'DPA_NEW_COUNSELLING_NOT_ALLOWED' }
		});
		const notice = getCounsellingDpaNotification(response, (key) => key);
		expect(notice).toMatchObject({
			notificationType: 'error',
			announce: 'alert',
			closeable: true,
			title: 'counselling.dpa.restricted.title',
			text: 'counselling.dpa.restricted.text'
		});
		expect(notice?.timeout).toBeUndefined();
	});
});
