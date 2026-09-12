export const resolveSupervisorDirectoryAgencyId = ({
	sessionAgencyId,
	metadataAgencyId
}: {
	sessionAgencyId?: string | number | null;
	metadataAgencyId?: string | number | null;
}): string | null => {
	const agencyId = sessionAgencyId ?? metadataAgencyId;

	return agencyId === undefined || agencyId === null
		? null
		: String(agencyId);
};

type SupervisorCandidate = {
	consultantId: string;
	isSupervisor?: boolean;
};

export const filterEligibleSupervisorConsultants = <
	T extends SupervisorCandidate
>({
	consultants,
	currentConsultantId,
	currentSupervisorIds
}: {
	consultants: T[];
	currentConsultantId?: string | null;
	currentSupervisorIds: string[];
}): T[] => {
	const existingIds = new Set(currentSupervisorIds);
	const uniqueConsultants = new Map<string, T>();

	consultants.forEach((consultant) => {
		if (!uniqueConsultants.has(consultant.consultantId)) {
			uniqueConsultants.set(consultant.consultantId, consultant);
		}
	});

	return Array.from(uniqueConsultants.values()).filter(
		(consultant) =>
			consultant.isSupervisor === true &&
			consultant.consultantId !== currentConsultantId &&
			!existingIds.has(consultant.consultantId)
	);
};
