import { describe, expect, it } from 'vitest';
import {
	deriveSendButtonState,
	getSendButtonTransition
} from './sendButtonState';

describe('deriveSendButtonState', () => {
	it('is empty without content', () => {
		expect(
			deriveSendButtonState({
				hasContent: false,
				isSending: false,
				isDisabled: false
			})
		).toBe('empty');
	});

	it('is ready with content', () => {
		expect(
			deriveSendButtonState({
				hasContent: true,
				isSending: false,
				isDisabled: false
			})
		).toBe('ready');
	});

	it('is sending while a request is in progress, regardless of content', () => {
		expect(
			deriveSendButtonState({
				hasContent: true,
				isSending: true,
				isDisabled: false
			})
		).toBe('sending');
		expect(
			deriveSendButtonState({
				hasContent: false,
				isSending: true,
				isDisabled: false
			})
		).toBe('sending');
	});

	it('is disabled when blocked (upload/recording), even with content', () => {
		expect(
			deriveSendButtonState({
				hasContent: true,
				isSending: false,
				isDisabled: true
			})
		).toBe('disabled');
	});

	it('disabled wins over sending', () => {
		expect(
			deriveSendButtonState({
				hasContent: true,
				isSending: true,
				isDisabled: true
			})
		).toBe('disabled');
	});
});

describe('getSendButtonTransition', () => {
	it('detects arm transition (empty -> ready) for the rotate-in animation', () => {
		expect(getSendButtonTransition('empty', 'ready')).toBe('arm');
	});

	it('detects fly-out transition (ready -> sending)', () => {
		expect(getSendButtonTransition('ready', 'sending')).toBe('fly-out');
	});

	it('detects settle transition back to empty after send', () => {
		expect(getSendButtonTransition('sending', 'empty')).toBe('settle');
	});

	it('returns none for identical or unrelated state changes', () => {
		expect(getSendButtonTransition('ready', 'ready')).toBe('none');
		expect(getSendButtonTransition('empty', 'disabled')).toBe('none');
		expect(getSendButtonTransition('disabled', 'ready')).toBe('none');
	});
});
