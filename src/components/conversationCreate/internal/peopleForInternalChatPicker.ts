import type { InternalChatColleague } from './loadInternalChatColleagues';

export const peopleForInternalChatPicker = (
	colleagues: readonly InternalChatColleague[]
) => {
	const labelCounts = new Map<string, number>();
	const people = colleagues.map(
		({ consultantId, displayName, tenantName, agencies }) => {
			const label = tenantName
				? `${displayName} (${tenantName})`
				: displayName;
			labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
			return { id: consultantId, label, agencies };
		}
	);

	return people.map(({ id, label, agencies }) => {
		if (labelCounts.get(label) === 1) return { id, label };

		const centres = [
			...new Set(agencies.map(({ name }) => name.trim()).filter(Boolean))
		]
			.sort()
			.join(', ');
		return { id, label: centres ? `${label} · ${centres}` : label };
	});
};
