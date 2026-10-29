import { describe, expect, it } from 'vitest';
import { MatrixError } from 'matrix-js-sdk';
import { getCounsellingDpaFailure } from './counsellingDpaFailure';
import { getCounsellingDpaNotification } from '../utils/counsellingDpaNotification';
import de from '../resources/i18n/de/common.json';
import en from '../resources/i18n/en/common.json';
import fr from '../resources/i18n/fr/common.json';
import ru from '../resources/i18n/ru/common.json';
import tr from '../resources/i18n/tr/common.json';
import ti from '../resources/i18n/ti/common.json';
import deInformal from '../resources/i18n/de@informal/common.json';

describe('authoritative counselling failure explanations', () => {
	it('recognizes an explicit native Matrix AVV refusal', () => {
		const error = new MatrixError(
			{
				'errcode': 'M_FORBIDDEN',
				'error': 'Not allowed to join this room',
				'org.oriso.reason': 'DPA_NEW_COUNSELLING_NOT_ALLOWED'
			},
			403
		);
		expect(getCounsellingDpaFailure(error)).toEqual({
			key: 'counselling.dpa.restricted',
			retryable: false
		});
	});

	it('keeps a native Matrix policy outage distinct and retryable', () => {
		const error = new MatrixError(
			{
				'errcode': 'M_UNKNOWN',
				'error': 'Group participation could not be checked',
				'org.oriso.reason': 'DPA_POLICY_UNAVAILABLE'
			},
			502
		);
		expect(getCounsellingDpaFailure(error)).toEqual({
			key: 'counselling.dpa.unavailable',
			retryable: true
		});
	});

	it.each([
		[403, 'M_FORBIDDEN', undefined],
		[403, 'M_FORBIDDEN', 'OTHER_PERMISSION'],
		[403, 'M_FORBIDDEN', 'DPA_POLICY_UNAVAILABLE'],
		[403, 'M_UNKNOWN', 'DPA_NEW_COUNSELLING_NOT_ALLOWED'],
		[502, 'M_FORBIDDEN', 'DPA_POLICY_UNAVAILABLE'],
		[502, 'M_UNKNOWN', 'DPA_NEW_COUNSELLING_NOT_ALLOWED'],
		[502, 'M_UNKNOWN', undefined],
		[401, 'M_UNKNOWN_TOKEN', 'DPA_NEW_COUNSELLING_NOT_ALLOWED'],
		[503, 'M_UNKNOWN', 'DPA_POLICY_UNAVAILABLE'],
		[403, 'M_FORBIDDEN', { reason: 'DPA_NEW_COUNSELLING_NOT_ALLOWED' }]
	] as const)(
		'does not infer AVV policy from a mismatched native Matrix reply %s/%s',
		(status, errcode, reason) => {
			expect(
				getCounsellingDpaFailure(
					new MatrixError(
						{
							errcode,
							'error': 'Synthetic ordinary failure',
							'org.oriso.reason': reason
						},
						status
					)
				)
			).toBeNull();
		}
	);

	it('does not trust objects which merely resemble Matrix errors', () => {
		expect(
			getCounsellingDpaFailure({
				httpStatus: 403,
				errcode: 'M_FORBIDDEN',
				data: { 'org.oriso.reason': 'DPA_NEW_COUNSELLING_NOT_ALLOWED' }
			})
		).toBeNull();
	});

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

	it('says "group", not "counselling", when someone joins a group (403)', () => {
		const response = new Response('', {
			status: 403,
			headers: { 'X-Reason': 'DPA_NEW_COUNSELLING_NOT_ALLOWED' }
		});
		const notice = getCounsellingDpaNotification(response, (key) => key, {
			groupJoin: true
		});
		expect(notice).toMatchObject({
			// Same id as the generic refusal, so dismiss-by-id keeps working.
			id: 'counselling.dpa.restricted',
			title: 'counselling.dpa.restrictedGroupJoin.title',
			text: 'counselling.dpa.restrictedGroupJoin.text'
		});
	});

	it('keeps the outage copy for a group join (retryable, nothing to rename)', () => {
		const response = new Response('', {
			status: 502,
			headers: { 'X-Reason': 'DPA_POLICY_UNAVAILABLE' }
		});
		expect(
			getCounsellingDpaNotification(response, (key) => key, {
				groupJoin: true
			})
		).toMatchObject({
			title: 'counselling.dpa.unavailable.title',
			text: 'counselling.dpa.unavailable.text'
		});
	});

	it.each([
		['de', de],
		['en', en],
		['fr', fr],
		['ru', ru],
		['tr', tr],
		['ti', ti]
	] as const)('has group-join refusal copy in %s', (_, dictionary) => {
		const copy = dictionary.counselling.dpa;
		expect(copy.restrictedGroupJoin.title.length).toBeGreaterThan(10);
		expect(copy.restrictedGroupJoin.text.length).toBeGreaterThan(60);
		expect(copy.restrictedGroupJoin.text).not.toEqual(copy.restricted.text);
		expect(copy.restrictedGroupJoin.title).not.toEqual(
			copy.restricted.title
		);
	});

	it('names the AVV and the group in German, formal and informal', () => {
		const formal = de.counselling.dpa.restrictedGroupJoin.text;
		const informal = deInformal.counselling.dpa.restrictedGroupJoin.text;
		expect(formal).toBe(
			'Der Beitritt zu dieser Gruppe ist derzeit nicht möglich, weil die Beratungsorganisation die aktuelle Auftragsverarbeitungsvereinbarung (AVV) noch bestätigen muss. Bitte wenden Sie sich an Ihre Beratungsstelle.'
		);
		expect(informal).toContain(
			'Bitte wende Dich an Deine Beratungsstelle.'
		);
		expect(informal).not.toMatch(/\b(Sie|Ihre)\b/);
		expect(formal).not.toMatch(/\b(Dich|Deine|wende)\b/);
		// No wording that suggests a new counselling is being refused.
		expect(formal + informal).not.toMatch(/Neue Beratung|neue Beratung/);
	});
});
