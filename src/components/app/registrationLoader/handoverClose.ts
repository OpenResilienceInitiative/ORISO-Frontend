/**
 * When the waiting room after "Registrieren" may give way to the app: the
 * person clicked the gate, the app has loaded, and a group invitation
 * (`?gcid=`) has been assigned. The gate opens itself after a while as an
 * escape hatch, so a click can come before the assignment; closing then
 * would flash the app's own route before the group's room.
 */
export const canCloseHandover = ({
	entered,
	appReady,
	groupJoinSettled
}: {
	entered: boolean;
	appReady: boolean;
	groupJoinSettled: boolean;
}) => entered && appReady && groupJoinSettled;
