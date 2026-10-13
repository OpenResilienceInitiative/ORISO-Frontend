let _matrixClientService:
	| import('./matrixClientService').MatrixClientService
	| null = null;

export const setMatrixClientServiceRef = (
	service: import('./matrixClientService').MatrixClientService | null
): void => {
	_matrixClientService = service;
};

export const getMatrixClientService = ():
	| import('./matrixClientService').MatrixClientService
	| null => _matrixClientService;

// Practice mode (FE#1622): a sandboxed client serves one subtree only and must
// never be attached to app-wide singletons that outlive it.
const sandboxedClients = new WeakSet<object>();

export const markSandboxedMatrixClient = (client: object): void => {
	sandboxedClients.add(client);
};

export const isSandboxedMatrixClient = (client: unknown): boolean =>
	typeof client === 'object' &&
	client !== null &&
	sandboxedClients.has(client);
