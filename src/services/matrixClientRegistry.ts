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
