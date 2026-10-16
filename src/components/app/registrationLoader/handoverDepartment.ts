/**
 * The department (ADR-003: agency × topic) a person registered for, carried
 * across the document load after "Registrieren". The waiting room's legal
 * links open that department's documents on both sides of the load; without
 * it they would fall back to the platform's (ADR-022).
 *
 * Best-effort like the rest of the hand-off: Web Storage may be disabled,
 * and then the links fall back to the platform documents.
 */
export type HandoverDepartment = { agencyId: number; topicId: number };

const KEY = 'handover-department';

const isDepartment = (value: unknown): value is HandoverDepartment =>
	typeof value === 'object' &&
	value !== null &&
	Number.isInteger((value as HandoverDepartment).agencyId) &&
	Number.isInteger((value as HandoverDepartment).topicId);

export const rememberHandoverDepartment = (
	department: HandoverDepartment | null
) => {
	try {
		if (department) sessionStorage.setItem(KEY, JSON.stringify(department));
		else sessionStorage.removeItem(KEY);
	} catch {
		/* the links fall back to the platform documents */
	}
};

export const readHandoverDepartment = (): HandoverDepartment | null => {
	try {
		const parsed: unknown = JSON.parse(
			sessionStorage.getItem(KEY) ?? 'null'
		);
		return isDepartment(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

export const forgetHandoverDepartment = () => rememberHandoverDepartment(null);
