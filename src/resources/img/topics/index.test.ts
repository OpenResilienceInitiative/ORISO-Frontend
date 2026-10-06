import { describe, it, expect } from 'vitest';
import fallbackCard from './fallback-card.png';
import schuldenCard from './t-05-schulden.png';
import {
	getTopicCardImage,
	hasTopicCardImage,
	topicSlug
} from './index';

describe('topicSlug', () => {
	it('lowercases and replaces German umlauts with their ASCII equivalents', () => {
		expect(topicSlug('Schulden')).toBe('schulden');
		expect(topicSlug('Trägerberatung')).toBe('tragerberatung');
		expect(topicSlug('Behinderung und psychische Beeinträchtigung')).toBe(
			'behinderung-und-psychische-beeintrachtigung'
		);
		expect(topicSlug('Straßensozialarbeit')).toBe('strassensozialarbeit');
	});

	it('collapses runs of non-alphanumeric characters into single hyphens', () => {
		expect(topicSlug('HIV & AIDS')).toBe('hiv-aids');
		expect(topicSlug('Aus-, Rück- und Weiterwanderung')).toBe(
			'aus-ruck-und-weiterwanderung'
		);
	});

	it('trims leading and trailing hyphens', () => {
		expect(topicSlug('  schulden  ')).toBe('schulden');
		expect(topicSlug('!!!schulden!!!')).toBe('schulden');
	});
});

describe('hasTopicCardImage', () => {
	it('is true for a topic whose slug has an entry in the asset map', () => {
		expect(hasTopicCardImage('Schulden')).toBe(true);
	});

	it('is false for a topic whose slug has no entry', () => {
		expect(hasTopicCardImage('Migration')).toBe(false);
	});

	it('is false for a null or empty topic', () => {
		expect(hasTopicCardImage(null)).toBe(false);
		expect(hasTopicCardImage(undefined)).toBe(false);
		expect(hasTopicCardImage('')).toBe(false);
	});
});

describe('getTopicCardImage', () => {
	it('returns the mapped Schulden card for a topic whose slug is registered', () => {
		expect(getTopicCardImage('Schulden')).toBe(schuldenCard);
	});

	it('falls back to the fallback card for an unmapped topic', () => {
		// A topic without artwork must never render a broken image; the picker
		// depends on this to safely enable new topics before their illustration
		// arrives.
		expect(getTopicCardImage('Migration')).toBe(fallbackCard);
	});

	it('falls back to the fallback card for null, undefined and empty topics', () => {
		expect(getTopicCardImage(null)).toBe(fallbackCard);
		expect(getTopicCardImage(undefined)).toBe(fallbackCard);
		expect(getTopicCardImage('')).toBe(fallbackCard);
	});
});
