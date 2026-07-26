export const getCurrentMatrixUserId = (): string =>
	typeof localStorage === 'undefined'
		? ''
		: localStorage.getItem('matrix_user_id') || '';
