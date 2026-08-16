import { describe, expect, it } from 'vitest';
import {
	answersSelection,
	consentBindingKey,
	consentInputKey,
	ConsentResolution,
	departmentMayHaveConsentText,
	mayAcceptConsent
} from './consentAcceptance';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';

const TOPIC = { id: 7, name: 'Suchtberatung' } as TopicsDataInterface;
const OTHER_TOPIC = { id: 8, name: 'Schuldnerberatung' } as TopicsDataInterface;

const agency = (id: number, hasPublishedDpp: boolean) =>
	({
		id,
		name: `Beratungsstelle ${id}`,
		departments: [{ topicId: TOPIC.id, hasPublishedDpp }]
	}) as unknown as AgencyDataInterface;

/** An agency whose `departments` have not arrived yet — the pre-load shape. */
const agencyWithoutDepartments = (id: number) =>
	({ id, name: `Beratungsstelle ${id}` }) as unknown as AgencyDataInterface;

const resolvedFor = (inputKey: string): ConsentResolution => ({
	status: 'resolved',
	consentText: null,
	inputKey
});

const unavailableFor = (inputKey: string): ConsentResolution => ({
	status: 'unavailable',
	inputKey
});

/**
 * Three review findings on PR #1110 turned out to be one defect: a resolution
 * whose identity was narrower than the set of inputs that decide what the
 * answer should be. First there was no identity (a pre-fetch state counted),
 * then agency/topic were missing (the previous Beratungsstelle's answer
 * counted), then applicability was missing (an answer produced while the
 * department looked unconfigured still counted after its `departments` arrived
 * and revealed a published policy — leaving the *platform* wording acceptable
 * where the Träger sentence must apply).
 *
 * Rather than widen the comparison a fourth time, the identity is derived once
 * from every input, as a single opaque string. These tests pin that: they are
 * the only place the window is observable, because Testing Library flushes
 * effects inside `act`, so a component test of it passes whether or not the
 * guard exists.
 */
describe('consentInputKey — the complete input state, in one value', () => {
	it('separates Beratungsstellen', () => {
		expect(consentInputKey(agency(42, true), TOPIC)).not.toBe(
			consentInputKey(agency(99, true), TOPIC)
		);
	});

	it('separates topics', () => {
		expect(consentInputKey(agency(42, true), TOPIC)).not.toBe(
			consentInputKey(agency(42, true), OTHER_TOPIC)
		);
	});

	it('separates a flip in applicability for an unchanged agency and topic', () => {
		/* The third instance, and the one plain id comparison cannot see: same
		   agency id, same topic id, but the department now reports a published
		   policy. The previous answer was "no Träger sentence, platform wording
		   applies" and must stop counting the moment that stops being true. */
		expect(consentInputKey(agency(42, false), TOPIC)).not.toBe(
			consentInputKey(agency(42, true), TOPIC)
		);
	});

	it('separates departments arriving late from a department without a policy', () => {
		// Same agency id, `departments` not loaded yet vs. loaded-and-published.
		expect(consentInputKey(agencyWithoutDepartments(42), TOPIC)).not.toBe(
			consentInputKey(agency(42, true), TOPIC)
		);
	});

	it('is stable for identical inputs', () => {
		expect(consentInputKey(agency(42, true), TOPIC)).toBe(
			consentInputKey(agency(42, true), TOPIC)
		);
	});

	it('gives the no-selection case its own identity', () => {
		expect(consentInputKey(undefined, undefined)).not.toBe(
			consentInputKey(agency(42, true), TOPIC)
		);
		expect(consentInputKey(undefined, undefined)).toBe(
			consentInputKey(undefined, undefined)
		);
	});
});

describe('mayAcceptConsent — may this consent be given at all', () => {
	const current = consentInputKey(agency(42, true), TOPIC);

	it('accepts a resolved answer for the inputs on screen', () => {
		expect(mayAcceptConsent(resolvedFor(current), current)).toBe(true);
	});

	it('rejects an answer for a different Beratungsstelle', () => {
		const other = consentInputKey(agency(99, true), TOPIC);
		expect(mayAcceptConsent(resolvedFor(other), current)).toBe(false);
	});

	it('rejects an answer produced before applicability flipped', () => {
		// The regression this whole identity exists for.
		const beforeFlip = consentInputKey(agency(42, false), TOPIC);
		expect(mayAcceptConsent(resolvedFor(beforeFlip), current)).toBe(false);
	});

	it('rejects a pending resolution', () => {
		expect(mayAcceptConsent({ status: 'pending' }, current)).toBe(false);
	});

	it('rejects an unavailable resolution — fail closed', () => {
		expect(mayAcceptConsent(unavailableFor(current), current)).toBe(false);
	});

	it('accepts the unconfigured case, which has an identity like any other', () => {
		const none = consentInputKey(undefined, undefined);
		expect(mayAcceptConsent(resolvedFor(none), none)).toBe(true);
	});
});

describe('answersSelection — does this answer still describe the inputs', () => {
	const current = consentInputKey(agency(42, true), TOPIC);

	it('accepts an answer produced for the inputs on screen', () => {
		expect(answersSelection(resolvedFor(current), current)).toBe(true);
	});

	it('rejects an answer produced before applicability flipped', () => {
		const beforeFlip = consentInputKey(agency(42, false), TOPIC);
		expect(answersSelection(resolvedFor(beforeFlip), current)).toBe(false);
	});

	it('treats pending as current, because it claims nothing about any inputs', () => {
		expect(answersSelection({ status: 'pending' }, current)).toBe(true);
	});

	it('keeps an unavailable answer for its own inputs, without permitting acceptance', () => {
		/* The distinction the two predicates must not blur: the failure notice
		   has to render, so the answer is current — but nothing about it is
		   permission to accept. */
		expect(answersSelection(unavailableFor(current), current)).toBe(true);
		expect(mayAcceptConsent(unavailableFor(current), current)).toBe(false);
	});

	it('discards an unavailable answer from previous inputs', () => {
		const other = consentInputKey(agency(99, true), TOPIC);
		expect(answersSelection(unavailableFor(other), current)).toBe(false);
	});
});

describe('departmentMayHaveConsentText', () => {
	it('is true only for a department reporting a published policy', () => {
		expect(departmentMayHaveConsentText(agency(42, true), TOPIC)).toBe(
			true
		);
		expect(departmentMayHaveConsentText(agency(42, false), TOPIC)).toBe(
			false
		);
	});

	it('is false while the departments are still unknown', () => {
		expect(
			departmentMayHaveConsentText(agencyWithoutDepartments(42), TOPIC)
		).toBe(false);
	});

	it('is false without an agency or a topic', () => {
		expect(departmentMayHaveConsentText(undefined, TOPIC)).toBe(false);
		expect(departmentMayHaveConsentText(agency(42, true), undefined)).toBe(
			false
		);
	});
});

describe('consentBindingKey', () => {
	it('separates Beratungsstellen, topics and versions', () => {
		const a = consentBindingKey(42, 7, 1);
		expect(consentBindingKey(99, 7, 1)).not.toBe(a);
		expect(consentBindingKey(42, 8, 1)).not.toBe(a);
		expect(consentBindingKey(42, 7, 2)).not.toBe(a);
		expect(consentBindingKey(42, 7, 1)).toBe(a);
	});

	it('treats a missing version as its own identity, not as a wildcard', () => {
		expect(consentBindingKey(42, 7, null)).not.toBe(
			consentBindingKey(42, 7, 1)
		);
		expect(consentBindingKey(42, 7, null)).toBe(
			consentBindingKey(42, 7, undefined)
		);
	});
});
