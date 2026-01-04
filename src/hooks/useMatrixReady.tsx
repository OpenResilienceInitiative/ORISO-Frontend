import { useState, useEffect } from 'react';

/**
 * Hook to check if Matrix client is initialized and ready for calls
 * Returns true when Matrix client exists and sync state is 'PREPARED'
 */
export const useMatrixReady = (): boolean => {
	const [isReady, setIsReady] = useState<boolean>(false);

	useEffect(() => {
		const checkMatrixReady = () => {
			const matrixClientService = (window as any).matrixClientService;
			
			if (!matrixClientService) {
				setIsReady(false);
				return;
			}

			// Check if client exists and is ready
			const client = matrixClientService.getClient();
			const ready = matrixClientService.isReady();
			
			setIsReady(ready);
			
			// If client exists but not ready, subscribe to sync state changes
			if (client && !ready) {
				const unsubscribe = matrixClientService.onSyncStateChange((state: string | null) => {
					const newReady = matrixClientService.isReady();
					setIsReady(newReady);
					
					if (newReady) {
						// Once ready, we can unsubscribe (optional - keeping it subscribed is fine too)
						console.log('✅ Matrix client is now ready!');
					}
				});
				
				return unsubscribe;
			}
		};

		// Initial check
		checkMatrixReady();

		// Poll periodically in case matrixClientService is set later
		const interval = setInterval(() => {
			checkMatrixReady();
		}, 500);

		return () => {
			clearInterval(interval);
		};
	}, []);

	return isReady;
};






