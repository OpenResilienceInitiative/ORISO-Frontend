/**
 * The Rust crypto internals that send a device-key query, so its response also
 * reaches the Olm machine. They are not part of the SDK's public CryptoApi.
 */
export type RustKeysQueryCrypto<User = unknown, Request = unknown> = {
	olmMachine?: {
		queryKeysForUsers?: (users: User[]) => Request;
	};
	outgoingRequestProcessor?: {
		makeOutgoingRequest?: (request: Request) => Promise<unknown>;
	};
};

export const canSubmitRustKeysQuery = <User, Request>(
	crypto: RustKeysQueryCrypto<User, Request> | undefined
): crypto is RustKeysQueryCrypto<User, Request> =>
	typeof crypto?.olmMachine?.queryKeysForUsers === 'function' &&
	typeof crypto.outgoingRequestProcessor?.makeOutgoingRequest === 'function';

export const submitRustKeysQuery = async <User, Request>(
	crypto: RustKeysQueryCrypto<User, Request>,
	users: User[]
): Promise<boolean> => {
	const machine = crypto.olmMachine;
	const processor = crypto.outgoingRequestProcessor;
	if (!machine?.queryKeysForUsers || !processor?.makeOutgoingRequest) {
		return false;
	}
	await processor.makeOutgoingRequest(machine.queryKeysForUsers(users));
	return true;
};
