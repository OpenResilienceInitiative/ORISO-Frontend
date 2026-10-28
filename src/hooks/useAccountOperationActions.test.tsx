// @vitest-environment oriso-jsdom
import { recordAccountOperationResponse } from '../utils/accountOperationIntent';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAccountOperationActions } from './useAccountOperationActions';
import {
	assertAccountOperationOwner,
	accountOperationOwner
} from '../utils/accountOperationOwner';

const session = vi.hoisted(() => ({ token: '' }));
vi.mock('../components/sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: () => session.token
}));
afterEach(() => {
	cleanup();
	session.token = '';
});
const tokenFor = (sub: string, revision: number) =>
	`header.${btoa(JSON.stringify({ sub, revision }))}.signature`;

it('keeps a mounted action through renewal, creates fresh ownership on account change and blocks old retries', () => {
	session.token = tokenFor('first-person', 1);
	const { result, rerender } = renderHook(useAccountOperationActions);
	const actions = result.current;
	const first = actions.prepare('save', '/users/data', {
		displayName: 'Same'
	});
	const headers = first.intent.headersFor('PATCH', '/users/data', '{}');
	session.token = tokenFor('first-person', 2);
	rerender();
	expect(result.current).toBe(actions);
	expect(actions.prepare('save', '/users/data', first.payload).intent).toBe(
		first.intent
	);
	session.token = tokenFor('second-person', 1);
	// No rerender is needed: the actual submission observes the current account.
	const next = actions.prepare('save', '/users/data', first.payload);
	expect(next.intent.id).not.toBe(first.intent.id);
	const owner = accountOperationOwner(session.token);
	expect(() => assertAccountOperationOwner(headers, owner, owner)).toThrow(
		'REQUEST_IDENTITY_CHANGED'
	);
});

it('restores the original A unknown action after A to B to A and retires only an explicit edit, success or verified refusal', async () => {
	session.token = tokenFor('person-A', 1);
	const { result } = renderHook(useAccountOperationActions);
	const actions = result.current;
	const payload = { displayName: 'Same' };
	const ids: string[] = [];
	let outcome: 'unknown' | 'success' | 'refused' = 'unknown';
	const submit = () =>
		actions.run('save', '/users/data', payload, async (_body, intent) => {
			ids.push(intent.id);
			if (outcome === 'unknown') throw new TypeError('reply lost');
			if (outcome === 'refused') {
				const response = new Response(null, {
					status: 403,
					headers: {
						'X-ORISO-Mutation-Outcome': 'NO_EFFECT',
						'X-ORISO-Mutation-Operation': intent.id
					}
				});
				recordAccountOperationResponse(response, response);
				return Promise.reject(response);
			}
			return undefined;
		});
	await expect(submit()).rejects.toThrow('reply lost');
	session.token = tokenFor('person-B', 1);
	await expect(submit()).rejects.toThrow('reply lost');
	expect(ids[1]).not.toBe(ids[0]);
	session.token = tokenFor('person-A', 2);
	await expect(submit()).rejects.toThrow('reply lost');
	expect(ids[2], 'account-intent-A-B-A-resumes-original-unknown-action').toBe(
		ids[0]
	);
	actions.edited('save', '/users/data');
	await expect(submit()).rejects.toThrow('reply lost');
	expect(ids[3]).not.toBe(ids[0]);
	outcome = 'success';
	await submit();
	expect(ids[4]).toBe(ids[3]);
	outcome = 'unknown';
	await expect(submit()).rejects.toThrow('reply lost');
	expect(ids[5]).not.toBe(ids[3]);
	outcome = 'refused';
	await expect(submit()).rejects.toBeInstanceOf(Response);
	expect(ids[6]).toBe(ids[5]);
	outcome = 'unknown';
	await expect(submit()).rejects.toThrow('reply lost');
	expect(ids[7]).not.toBe(ids[5]);
	// A's edit, successful write and terminal refusal never retire B's action.
	session.token = tokenFor('person-B', 2);
	await expect(submit()).rejects.toThrow('reply lost');
	expect(ids[8]).toBe(ids[1]);
});
