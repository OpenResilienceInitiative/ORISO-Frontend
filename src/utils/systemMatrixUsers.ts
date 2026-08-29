/**
 * Matrix user IDs that must be filtered out of user-facing member lists.
 *
 * The client filters two classes of non-human account before rendering
 * recipients or member lists:
 *
 * 1. `@system` — the app's own system-notice sender across every deployment.
 * 2. `@caritas.local` — the pre-ADR-005 Matrix homeserver name. ADR-005
 *    moved the homeserver to `matrix.oriso.org`, but accounts provisioned
 *    against the old homeserver survive in older-provisioned rooms, and
 *    some environments may still use `@caritas.local` as their `server_name`.
 *    Removing the filter blindly would silently re-surface those service
 *    accounts as if they were counsellors — see ORISO-Frontend#968 remnant
 *    4. The literal stays until every environment confirms its
 *    `server_name` and legacy accounts have been rotated.
 *
 * Callers that also need to filter agency-service bots
 * (`^@agency-<id>-service:`) extend this with their own check — that pattern
 * is domain-specific to a couple of composers and does not belong here.
 */

/** Matches Matrix accounts on the legacy Caritas homeserver (pre-ADR-005). */
export const LEGACY_MATRIX_HOMESERVER_SUFFIX = '@caritas.local';

/**
 * True for Matrix system accounts (`@system`) and pre-ADR-005 legacy accounts
 * on the `@caritas.local` homeserver. Never true for a human counsellor or
 * advice seeker on the current homeserver.
 */
export const isSystemMatrixUser = (
	userId: string | null | undefined
): boolean => {
	if (!userId) {
		return false;
	}
	return (
		userId.includes('@system') ||
		userId.includes(LEGACY_MATRIX_HOMESERVER_SUFFIX)
	);
};
