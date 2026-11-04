import { useContext } from 'react';
import { UserDataContext } from '../globalState';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';

/** Profile preview and editor keep the same existing Matrix-id default seed. */
export const useOwnAvatarUserId = () => {
	// The context is `null` until a provider is above us, and the call surface
	// is now one of the places that asks before that is guaranteed. Reading it
	// defensively is cheaper than making every caller prove it has a provider.
	const userData = useContext(UserDataContext)?.userData;
	const matrixContext = useContext(MatrixClientContext);
	return (
		matrixContext?.matrixClientService?.getClient?.()?.getUserId?.() ||
		userData?.userId
	);
};
