import { describe, expect, it } from 'vitest';
import {
	formatMessagePersonName,
	getMessagePersonInitials
} from './messageNameUtils';

describe('formatMessagePersonName', () => {
	it('prefers the real name when present', () => {
		expect(
			formatMessagePersonName('ignored', 'ignored', 'Karina', 'P')
		).toBe('Karina P');
	});

	it('keeps anonymous display names untouched', () => {
		expect(formatMessagePersonName('sanftes Alpaka Kim', undefined)).toBe(
			'sanftes Alpaka Kim'
		);
	});

	it('humanizes technical usernames with underscores', () => {
		expect(formatMessagePersonName(undefined, 'free_bee_frankie_821')).toBe(
			'free bee frankie'
		);
	});

	it('humanizes technical display names too', () => {
		expect(formatMessagePersonName('free_bee_frankie_821', undefined)).toBe(
			'free bee frankie'
		);
	});

	it('keeps the numeric suffix when it is the only distinguishing part', () => {
		expect(formatMessagePersonName(undefined, 'user_821')).toBe('user');
	});

	it('strips matrix domain and @ prefix', () => {
		expect(
			formatMessagePersonName(undefined, '@free_bee_frankie_821:oriso.de')
		).toBe('free bee frankie');
	});
});

describe('getMessagePersonInitials', () => {
	it('uses first letters of the humanized name', () => {
		expect(
			getMessagePersonInitials(undefined, 'free_bee_frankie_821')
		).toBe('FB');
	});
});
