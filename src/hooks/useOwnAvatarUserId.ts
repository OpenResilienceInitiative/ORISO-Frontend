import { useContext } from 'react';
import { UserDataContext } from '../globalState';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';

/** Profile preview and editor keep the same existing Matrix-id default seed. */
export const useOwnAvatarUserId = () => {
	const { userData } = useContext(UserDataContext);
	const matrixContext = useContext(MatrixClientContext);
	return (
		matrixContext?.matrixClientService?.getClient?.()?.getUserId?.() ||
		userData.userId
	);
};
