import { MATRIX_USER_ID_STORAGE_KEY } from './matrixStorageKeys';

export const getCurrentMatrixUserId = (): string =>
	typeof localStorage === 'undefined'
		? ''
		: localStorage.getItem(MATRIX_USER_ID_STORAGE_KEY) || '';
