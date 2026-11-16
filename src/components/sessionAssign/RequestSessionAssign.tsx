import { getCounsellingDpaFailure } from '../../api/counsellingDpaFailure';
import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import {
	apiDeleteUserFromRoom,
	apiGetAgencyConsultantList,
	apiSessionAssign
} from '../../api';
import {
	ConsultantListContext,
	E2EEContext,
	SessionTypeContext,
	UserDataContext,
	ActiveSessionContext
} from '../../globalState';
import { UserDataInterface } from '../../globalState/interfaces';
import { OrisoSelect } from '../form/OrisoSelect';
import { useE2EE } from '../../hooks/useE2EE';
import { prepareConsultantDataForSelect } from './sessionAssignHelper';
import { SelectChangeEvent } from '@mui/material/Select';
import { AskerInfoActionContext } from '../askerInfo/askerInfoActionContext';

export const ACCEPTED_GROUP_CLOSE = 'CLOSE';

/*
 * Initial enquiry assignment only (ORISO-Frontend#1673).
 *
 * This select used to confirm with REASSIGN, which posted a
 * REASSIGN_CONSULTANT alias to the removed /service/messages/aliasonly/new
 * endpoint (404). Handing over an active case now goes through the guarded
 * case-handover offer ("Beratung übergeben"), so the select is only shown for
 * enquiries and confirms through the supported assignment endpoint.
 */
const ASSIGN_DONE = 'ASSIGN_DONE';

export const RequestSessionAssign = (props: { value?: string }) => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();

	const { activeSession } = useContext(ActiveSessionContext);
	const { path: listPath } = useContext(SessionTypeContext);
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { consultantList, setConsultantList } = useContext(
		ConsultantListContext
	);
	const [overlayActive, setOverlayActive] = useState(false);
	const [overlayItem, setOverlayItem] = useState({});
	const [selectedOption, setSelectedOption] = useState(null);

	const { isE2eeEnabled } = useContext(E2EEContext);
	const { setHasPendingChange } = useContext(AskerInfoActionContext);

	/*
	 * The one value the select actually renders. Everything downstream reads
	 * this, so the footer and the dropdown cannot disagree.
	 *
	 * `props.value` deliberately wins: `AskerInfoAssign` pins it to the
	 * session's current consultant, and `OrisoSelect` wraps a fully controlled
	 * MUI Select, so the dropdown shows the current allocation until a
	 * assignment is actually confirmed (which navigates away).
	 */
	const displayedConsultantId = props.value || selectedOption?.value || '';

	/*
	 * Derived, never set imperatively (ORISO-Frontend#1192 review).
	 *
	 * It used to be latched in `handleDatalistSelect` and nothing cleared it:
	 * cancelling the confirmation dialog runs the `CLOSE` branch, which resets
	 * the overlay and returns, so the footer's next button stayed primary and
	 * enabled indefinitely while the select had already snapped back to the
	 * original consultant. Reading the same value the select renders makes the
	 * two agree by construction instead of by remembering to reset a flag.
	 */
	const hasPendingChange = Boolean(
		displayedConsultantId &&
			displayedConsultantId !== activeSession?.consultant?.id
	);

	useEffect(() => {
		setHasPendingChange(hasPendingChange);
	}, [hasPendingChange, setHasPendingChange]);

	const { addNewUsersToEncryptedRoom } = useE2EE(
		activeSession.item.matrixRoomId
	);

	useEffect(() => {
		const agencyId = activeSession.item.agencyId.toString();
		if (consultantList && consultantList.length <= 0) {
			apiGetAgencyConsultantList(agencyId)
				.then((response) => {
					const consultants =
						prepareConsultantDataForSelect(response);
					setConsultantList(consultants);
				})
				.catch((error) => {
					// console.log(error);
				});
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const initOverlays = (selected) => {
		if (selected?.value === activeSession?.consultant?.id) return;

		// No promise of the full message history here: that is only true for
		// the guarded handover after the recipient's decision and consent.
		const assignSession: OverlayItem = {
			headline: translate('session.assignOther.overlay.headline.1', {
				client: activeSession.user.username,
				newConsultant: selected.label
			}),
			buttonSet: [
				{
					label: translate(
						'session.assignSelf.overlay.button.cancel'
					),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.SECONDARY
				},
				{
					label: translate(
						'session.assignSelf.overlay.button.assign'
					),
					function: OVERLAY_FUNCTIONS.ASSIGN,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		};

		setOverlayActive(true);
		setOverlayItem(assignSession);
	};

	const showAssignSuccess = () => {
		setOverlayItem({
			headline: translate('session.assignOther.overlay.headline.2'),
			buttonSet: [
				{
					label: translate('session.assignOther.button.label'),
					function: ASSIGN_DONE,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		});
		setOverlayActive(true);
	};

	const handleE2EEAssign = async (sessionId, userId) => {
		if (isE2eeEnabled) {
			try {
				await addNewUsersToEncryptedRoom();
				await apiDeleteUserFromRoom(sessionId, userId);
			} catch (e) {
				// console.log('error encrypting new user key');
			}
		}
	};

	const handleDatalistSelect = (selectedOption) => {
		setSelectedOption(selectedOption);
		initOverlays(selectedOption);
	};

	const handleConsultantSelect = (event: SelectChangeEvent<string>) => {
		const selectedConsultant = consultantList.find(
			(consultant) => consultant.value === event.target.value
		);

		if (selectedConsultant) {
			handleDatalistSelect(selectedConsultant);
		}
	};

	const handleOverlayAction = (buttonFunction: string) => {
		switch (buttonFunction) {
			case OVERLAY_FUNCTIONS.ASSIGN:
				apiSessionAssign(activeSession.item.id, selectedOption.value)
					.then(() => {
						showAssignSuccess();
						if (userData) {
							handleE2EEAssign(
								activeSession.item.id,
								userData.userId
							);
						} else {
							reloadUserData()
								.then((profileData: UserDataInterface) => {
									handleE2EEAssign(
										activeSession.item.id,
										profileData.userId
									);
								})
								.catch(() => undefined);
						}
					})
					.catch((error) => {
						const failure = getCounsellingDpaFailure(error);
						if (failure) {
							setOverlayItem({
								headline: translate(`${failure.key}.title`),
								copy: translate(`${failure.key}.text`),
								buttonSet: [
									{
										label: translate(
											'profile.data.registerError.overlay.button.label'
										),
										function: OVERLAY_FUNCTIONS.CLOSE,
										type: BUTTON_TYPES.PRIMARY
									}
								]
							});
							setOverlayActive(true);
							return;
						}
						// CONFLICT: someone else assigned it first. Either way
						// the confirmation closes and the select snaps back.
						setOverlayItem(null);
						setOverlayActive(false);
					});
				break;
			case ASSIGN_DONE:
				setOverlayItem(null);
				setOverlayActive(false);
				navigate(listPath);
				break;
			case OVERLAY_FUNCTIONS.CLOSE:
				setOverlayItem(null);
				setOverlayActive(false);
				break;
		}
	};

	return (
		<div className="assign__wrapper">
			<OrisoSelect
				id="assignSelect"
				label={translate('session.u25.assignment.placeholder')}
				options={consultantList.map((consultant) => ({
					value: consultant.value,
					label: consultant.label
				}))}
				value={displayedConsultantId}
				onChange={handleConsultantSelect}
			/>
			{overlayActive && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</div>
	);
};
