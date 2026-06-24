import { useState, useEffect } from 'react';
import { matrixClientService } from '../services/matrixClientService';

/**
 * Hook to check if Matrix client is initialized and ready for calls
 * Returns true when Matrix client exists and sync state is 'PREPARED'
 */
export const useMatrixReady = (): boolean => {
	const [isReady, setIsReady] = useState<boolean>(false);

	useEffect(() => {
		const checkMatrixReady = () => {
			const client = matrixClientService.getClient();

			if (!client) {
				setIsReady(false);
				return;
			}

			const ready = matrixClientService.isReady();
			setIsReady(ready);

			if (!ready) {
				return matrixClientService.onSyncStateChange(
					(state: string | null) => {
						setIsReady(matrixClientService.isReady());
					}
				);
			}
		};

		const unsubscribe = checkMatrixReady();

		const interval = setInterval(() => {
			setIsReady(matrixClientService.isReady());
		}, 500);

		return () => {
			if (typeof unsubscribe === 'function') {
				unsubscribe();
			}
			clearInterval(interval);
		};
	}, []);

	return isReady;
};
