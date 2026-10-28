import type { AccountOperationIntent } from './accountOperationIntent';

// The mounted action and its transport keep separate, memory-only ownership.
// An explicitly public call can be initiated by a signed-in person.
const actionOwners = new WeakMap<AccountOperationIntent, string>();
const requestOwners = new WeakMap<AccountOperationIntent, string>();
const headerIntents = new WeakMap<object, AccountOperationIntent>();

export const accountOperationOwner = (
	token: string | null | undefined
): string => {
	if (!token) return 'anonymous';
	try {
		const payload = JSON.parse(
			atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
		);
		if (typeof payload.sub === 'string' && payload.sub) {
			return JSON.stringify([
				'subject',
				payload.iss ?? null,
				payload.sub
			]);
		}
	} catch {
		// An unreadable token may make its first attempt, but a different token
		// cannot be assumed to belong to the same person. Nothing is persisted.
	}
	return 'unverified';
};

export const ownAccountOperation = (
	intent: AccountOperationIntent,
	owner: string
): void => {
	const previous = actionOwners.get(intent);
	if (previous !== undefined && previous !== owner)
		throw new Error('REQUEST_IDENTITY_CHANGED');
	actionOwners.set(intent, owner);
};

export const inheritAccountOperationOwner = (
	parent: AccountOperationIntent,
	child: AccountOperationIntent
): void => {
	const owner = actionOwners.get(parent);
	if (owner !== undefined) ownAccountOperation(child, owner);
};

export const registerAccountOperationHeaders = <T extends object>(
	headers: T,
	intent: AccountOperationIntent
): T => {
	headerIntents.set(headers, intent);
	return headers;
};

export const assertAccountOperationOwner = (
	headers: object | undefined,
	currentOwner: string,
	requestOwner: string
): void => {
	const intent = headers ? headerIntents.get(headers) : undefined;
	if (!intent) return;
	const actionOwner = actionOwners.get(intent);
	const previous = requestOwners.get(intent);
	if (
		(actionOwner !== undefined && actionOwner !== currentOwner) ||
		(previous !== undefined &&
			(previous !== requestOwner || previous === 'unverified'))
	) {
		throw new Error('REQUEST_IDENTITY_CHANGED');
	}
	requestOwners.set(intent, requestOwner);
};
