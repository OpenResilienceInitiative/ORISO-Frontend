import {
	inheritAccountOperationOwner,
	registerAccountOperationHeaders,
	ownAccountOperation
} from './accountOperationOwner';
// Request bindings contain passwords/codes on some paths. Keep them only in
// memory, outside serializable intent objects; never write them to storage.
const bindings = new WeakMap<AccountOperationIntent, string>();
const children = new WeakMap<
	AccountOperationIntent,
	Map<string, AccountOperationIntent>
>();
const acknowledgements = new WeakMap<AccountOperationIntent, () => void>();

const uncertainIntents = new WeakSet<AccountOperationIntent>();
const uncertainErrors = new WeakSet<object>();
const verifiedRefusals = new WeakMap<object, string>();
const observedResponses = new WeakMap<
	object,
	{ status: number; outcome: string | null; operation: string | null }
>();

// Internal transport evidence; arbitrary Error properties cannot create an acknowledgement.
export const recordAccountOperationResponse = (
	error: unknown,
	response: Response
) => {
	if (
		error !== null &&
		(typeof error === 'object' || typeof error === 'function')
	) {
		observedResponses.set(error, {
			status: response.status,
			outcome: response.headers?.get('X-ORISO-Mutation-Outcome') ?? null,
			operation:
				response.headers?.get('X-ORISO-Mutation-Operation') ?? null
		});
	}
};

export const acknowledgeAccountOperation = (
	intent?: AccountOperationIntent
) => {
	if (intent) {
		uncertainIntents.delete(intent);
		acknowledgements.get(intent)?.();
	}
};

/** Only observed response metadata can end a refused action. Error text cannot. */
export const isTerminalAccountOperationRefusal = (
	error: unknown,
	intent?: AccountOperationIntent
): boolean => {
	const object =
		error !== null &&
		(typeof error === 'object' || typeof error === 'function')
			? error
			: undefined;
	const response = object ? observedResponses.get(object) : undefined;
	let status: number | undefined;
	if (typeof Response !== 'undefined' && error instanceof Response) {
		status = error.status;
	} else if (error instanceof Error) {
		status = (error as Error & { status?: number }).status;
	}
	status = response?.status ?? status;
	const raw =
		typeof Response !== 'undefined' && error instanceof Response
			? error
			: undefined;
	const outcome =
		response?.outcome ?? raw?.headers.get('X-ORISO-Mutation-Outcome');
	const operation =
		response?.operation ?? raw?.headers.get('X-ORISO-Mutation-Operation');
	if (
		object &&
		intent &&
		outcome === 'NO_EFFECT' &&
		operation === intent.id &&
		[400, 403, 409].includes(status ?? 0)
	) {
		verifiedRefusals.set(object, intent.id);
		uncertainErrors.delete(object);
		return true;
	}
	// A remote account attempt needs a matching committed receipt. HTTP
	// status alone cannot prove that an earlier native effect did not occur.
	if (intent) return false;
	if (object && uncertainErrors.has(object)) return false;
	const verifiedOperation = object ? verifiedRefusals.get(object) : undefined;
	if (
		verifiedOperation !== undefined &&
		(!intent || verifiedOperation === intent.id)
	)
		return true;
	if (intent && uncertainIntents.has(intent)) return false;
	return status !== undefined && [400, 403, 412, 422].includes(status);
};

export const accountOperationFailed = (
	intent: AccountOperationIntent | undefined,
	error: unknown
): boolean => {
	const terminal = isTerminalAccountOperationRefusal(error, intent);
	if (!terminal && intent) {
		uncertainIntents.add(intent);
		if (
			error !== null &&
			(typeof error === 'object' || typeof error === 'function')
		)
			uncertainErrors.add(error);
	}
	return terminal;
};

export const settleAccountOperation = async <T>(
	intent: AccountOperationIntent | undefined,
	result: Promise<T>
): Promise<T> => {
	try {
		const response = await result;
		acknowledgeAccountOperation(intent);
		return response;
	} catch (error) {
		if (accountOperationFailed(intent, error))
			acknowledgeAccountOperation(intent);
		throw error;
	}
};

/** A correlation ID for one account action. It grants no authority. */
export class AccountOperationIntent {
	readonly id: string;

	constructor(id: string = crypto.randomUUID()) {
		if (
			!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
				id
			)
		) {
			throw new Error('Account intent must be a canonical UUID');
		}
		this.id = id;
		Object.freeze(this);
	}

	headersFor(method: string, target: string, body?: string) {
		const binding = JSON.stringify([method, target, body ?? null]);
		const previous = bindings.get(this);
		if (previous !== undefined && previous !== binding) {
			throw new Error(
				'Intent already belongs to a different account operation'
			);
		}
		bindings.set(this, binding);
		return registerAccountOperationHeaders(
			{ 'Idempotency-Key': this.id },
			this
		);
	}

	/** Separate effects of one save have separate, stable request IDs. */
	subIntent(name: string): AccountOperationIntent {
		let subIntents = children.get(this);
		if (!subIntents) {
			subIntents = new Map();
			children.set(this, subIntents);
		}
		if (!subIntents.has(name))
			subIntents.set(name, new AccountOperationIntent());
		const child = subIntents.get(name)!;
		inheritAccountOperationOwner(this, child);
		return child;
	}
}

export interface AccountOperationAttempt<T> {
	readonly intent: AccountOperationIntent;
	readonly payload: T;
}

export class AccountOperationSlot<T> {
	private current?: AccountOperationAttempt<T>;
	private fingerprint?: string;

	/** Call at the intentional action, before fetch or a retry callback. */
	prepare(
		operation: string,
		target: string,
		payload: T,
		materialize?: (payload: T) => T
	): AccountOperationAttempt<T> {
		const fingerprint = JSON.stringify([operation, target, payload]);
		if (!this.current || this.fingerprint !== fingerprint) {
			const submitted = JSON.parse(JSON.stringify(payload)) as T;
			const prepared = materialize ? materialize(submitted) : submitted;
			this.current = Object.freeze({
				intent: new AccountOperationIntent(),
				payload: freezeSnapshot(JSON.parse(JSON.stringify(prepared)))
			});
			const intent = this.current.intent;
			acknowledgements.set(intent, () => this.acknowledge(intent));
			this.fingerprint = fingerprint;
		}
		return this.current;
	}

	/** A late response can only finish its own action, never a newer edit. */
	acknowledge(intent: AccountOperationIntent): void {
		if (this.current?.intent === intent) {
			this.current = undefined;
			this.fingerprint = undefined;
		}
	}
}

const freezeSnapshot = <T>(value: T): T => {
	if (value && typeof value === 'object') {
		Object.values(value).forEach(freezeSnapshot);
		Object.freeze(value);
	}
	return value;
};

export const accountOperationHeaders = (
	intent: AccountOperationIntent | undefined,
	method: string,
	target: string,
	body?: string
) => intent?.headersFor(method, target, body);

/** Owned by a mounted action/form, never by fetch or React Query retry. */
export class AccountOperationActions {
	private slots = new Map<string, AccountOperationSlot<unknown>>();
	private owner?: string;

	private readonly readOwner?: () => string;
	constructor(readOwner?: () => string) {
		this.readOwner = readOwner;
	}

	// A returning person can resume their unknown action. Other people's
	// edits/acknowledgements never evict it; the mounted form owns this map.
	private currentOwner(): string | undefined {
		const owner = this.readOwner?.();
		if (owner !== this.owner) {
			this.owner = owner;
		}
		return owner;
	}

	edited(operation: string, target: string): void {
		// An intentional edit supersedes the previous form action. Its already
		// captured transport retry still owns its old immutable intent object.
		this.slots.delete(
			JSON.stringify([this.currentOwner(), operation, target])
		);
	}

	private slotFor(operation: string, target: string) {
		this.currentOwner();
		const key = JSON.stringify([this.owner, operation, target]);
		let slot = this.slots.get(key);
		if (!slot) {
			slot = new AccountOperationSlot();
			this.slots.set(key, slot);
		}
		return slot;
	}

	prepare<T>(
		operation: string,
		target: string,
		payload: T,
		materialize?: (payload: T) => T
	): AccountOperationAttempt<T> {
		const slot = this.slotFor(operation, target) as AccountOperationSlot<T>;
		const attempt = slot.prepare(operation, target, payload, materialize);
		if (this.owner !== undefined)
			ownAccountOperation(attempt.intent, this.owner);
		return attempt;
	}

	async run<T, R>(
		operation: string,
		target: string,
		payload: T,
		send: (payload: T, intent: AccountOperationIntent) => Promise<R>
	): Promise<R> {
		const slot = this.slotFor(operation, target);
		const attempt = this.prepare(operation, target, payload);
		let result: R;
		try {
			result = await send(attempt.payload as T, attempt.intent);
		} catch (error) {
			if (accountOperationFailed(attempt.intent, error))
				slot.acknowledge(attempt.intent);
			throw error;
		}
		// Finish before unrelated cache reloads, notifications or logout. A
		// failure in those steps does not make an acknowledged write unknown.
		slot.acknowledge(attempt.intent);
		return result;
	}
}
