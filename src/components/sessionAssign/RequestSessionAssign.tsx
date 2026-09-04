import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import {
	apiDeleteUserFromRoom,
	apiGetAgencyConsultantList,
	apiSessionAssign,
	FETCH_ERRORS
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
import {
	ALIAS_MESSAGE_TYPES,
	apiSendAliasMessage,
	ConsultantReassignment,
	ReassignStatus
} from '../../api/apiSendAliasMessage';
import { prepareConsultantDataForSelect } from './sessionAssignHelper';
import { SelectChangeEvent } from '@mui/material/Select';
import { AskerInfoActionContext } from '../askerInfo/askerInfoActionContext';

export const ACCEPTED_GROUP_CLOSE = 'CLOSE';

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
	const [reassignmentParams, setReassignmentParams] =
		useState<ConsultantReassignment | null>(null);

	const { isE2eeEnabled } = useContext(E2EEContext);
	const { confirmNonce, setHasPendingChange } = useContext(
		AskerInfoActionContext
	);

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

	const initOverlays = (selected, profileData) => {
		if (selected?.value === activeSession?.consultant?.id) return;
		const selectedConsultant = consultantList.filter(
			(consultant) => consultant.value === activeSession?.consultant?.id
		)[0];

		const client = activeSession.user.username;
		const newConsultant = selected.label;
		const toAskerName = client;
		setReassignmentParams({
			toConsultantId: selected.value,
			toConsultantName: selected.consultantDisplayName,
			toAskerName,
			fromConsultantId: selectedConsultant?.value,
			fromConsultantName: selectedConsultant?.consultantDisplayName,
			status: ReassignStatus.REQUESTED
		});

		let overlayText = translate(
			'session.assignOther.overlay.subtitle.noTeam',
			{
				newConsultant
			}
		);

		const reassignSession: OverlayItem = {
			headline: translate('session.assignOther.overlay.headline.1', {
				client,
				newConsultant
			}),
			copy: overlayText,
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
					function: OVERLAY_FUNCTIONS.REASSIGN,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		};

		const overlay = reassignSession;
		setOverlayActive(true);
		setOverlayItem(overlay);
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

	/*
	 * Picking a consultant used to open the confirmation overlay straight away.
	 * The client profile now carries a footer whose next button is the "continue
	 * with the action" step (ORISO-Frontend#1192), so selection only records the
	 * choice and reports it as pending — the overlay is raised when the user
	 * presses next, via `confirmNonce` below.
	 */
	const handleDatalistSelect = (selectedOption) => {
		setSelectedOption(selectedOption);
		setHasPendingChange(
			selectedOption?.value !== activeSession?.consultant?.id
		);
	};

	const handleConsultantSelect = (event: SelectChangeEvent<string>) => {
		const selectedConsultant = consultantList.find(
			(consultant) => consultant.value === event.target.value
		);

		if (selectedConsultant) {
			handleDatalistSelect(selectedConsultant);
		}
	};

	// The footer's next button bumps the nonce; 0 is the initial render, which
	// must not raise an overlay for a selection the user has not made yet.
	useEffect(() => {
		if (confirmNonce === 0 || !selectedOption) {
			return;
		}
		initOverlays(selectedOption, userData);
	}, [confirmNonce]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleOverlayAction = (buttonFunction: string) => {
		switch (buttonFunction) {
			case OVERLAY_FUNCTIONS.ASSIGN:
				apiSessionAssign(activeSession.item.id, selectedOption.value)
					.then(() => {
						if (userData) {
							initOverlays(selectedOption, userData);
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
									initOverlays(selectedOption, profileData);
								})
								.catch((error) => {
									/* console.log(error); */
								});
						}
					})
					.catch((error) => {
						if (error === FETCH_ERRORS.CONFLICT) {
							return null;
						}
					});
				break;
			case OVERLAY_FUNCTIONS.REASSIGN:
				apiSendAliasMessage({
					matrixRoomId: activeSession.rid,
					type: ALIAS_MESSAGE_TYPES.REASSIGN_CONSULTANT,
					args: reassignmentParams
				});
				setOverlayItem(null);
				setOverlayActive(false);

				navigate(
					`${listPath}/${activeSession.item.matrixRoomId}/${activeSession.item.id}`
				);
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
				/* The user's own choice wins over the session's current
				   consultant. `props.value ||` short-circuited it away, so the
				   select kept showing the old consultant after picking a new
				   one — the design shows the picked name, and the footer's next
				   button is meaningless without that feedback. */
				value={selectedOption?.value ?? props.value ?? ''}
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
