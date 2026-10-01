interface ExistingSessionLookup<T> {
	load: () => Promise<T>;
	isCurrent: () => boolean;
	onResolved: (value: T) => void;
	onFailure: () => void;
}

export const resolveExistingSession = async <T>({
	load,
	isCurrent,
	onResolved,
	onFailure
}: ExistingSessionLookup<T>): Promise<void> => {
	try {
		const value = await load();
		if (isCurrent()) {
			onResolved(value);
		}
	} catch {
		if (isCurrent()) {
			onFailure();
		}
	}
};
