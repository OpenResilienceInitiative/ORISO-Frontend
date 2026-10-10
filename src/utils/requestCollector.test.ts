// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { RequestLog } from './requestCollector';

const logged = (url: string) => new RequestLog(url, 'PUT').url;

/** The request log is shown in the DevToolbar; invite tokens stay out of it. */
describe('RequestLog keeps invite tokens out of the logged URL', () => {
	it('redacts the token however its key is cased', () => {
		expect(logged('/service/users/chat/15/assign?InviteToken=s3cret')).toBe(
			'/service/users/chat/15/assign?InviteToken=[redacted]'
		);
	});

	it('redacts the token when its key is percent-encoded', () => {
		expect(logged('/chat/15/assign?invite%54oken=s3cret')).not.toContain(
			's3cret'
		);
	});

	it('keeps the other parameters and the fragment', () => {
		expect(
			logged('/chat/15/assign?a=1&inviteToken=s3cret&b=two#part')
		).toBe('/chat/15/assign?a=1&inviteToken=[redacted]&b=two#part');
	});

	it('leaves a URL without a token unchanged', () => {
		const url = 'https://api.test.local/service/users/chat/15?a=1&b=%20x#f';
		expect(logged(url)).toBe(url);
	});
});
