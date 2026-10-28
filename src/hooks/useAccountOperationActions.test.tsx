// @vitest-environment oriso-jsdom
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
