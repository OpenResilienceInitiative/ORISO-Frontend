import { describe, expect, it } from 'vitest';
import { agencyExcludesTopic } from './agencyTopicMatch';

const agency = (topicIds?: number[]) => ({ id: 7, topicIds }) as any;
const topic = (id?: number) => (id === undefined ? undefined : ({ id } as any));

describe('agencyExcludesTopic', () => {
	it('reports a mismatch when the agency does not offer the topic', () => {
		expect(agencyExcludesTopic(agency([1, 2]), topic(3))).toBe(true);
	});

	it('reports no mismatch when the agency offers the topic', () => {
		expect(agencyExcludesTopic(agency([1, 2, 3]), topic(3))).toBe(false);
	});

	it('reports a mismatch for an agency that offers nothing', () => {
		expect(agencyExcludesTopic(agency([]), topic(3))).toBe(true);
	});

	// Proof, not suspicion: a selection is only destroyed when the agency is
	// known AND its topic list says the topic is not among them.
	it('reports no mismatch when there is no topic to invalidate', () => {
		expect(agencyExcludesTopic(agency([1]), undefined)).toBe(false);
		expect(agencyExcludesTopic(agency([1]), topic(undefined))).toBe(false);
	});

	it('reports no mismatch when the agency is unknown', () => {
		expect(agencyExcludesTopic(undefined, topic(3))).toBe(false);
		expect(agencyExcludesTopic(null as any, topic(3))).toBe(false);
	});

	it('reports no mismatch when the topic list could not be read', () => {
		expect(agencyExcludesTopic(agency(undefined), topic(3))).toBe(false);
		expect(agencyExcludesTopic({ id: 7 } as any, topic(3))).toBe(false);
	});
});
