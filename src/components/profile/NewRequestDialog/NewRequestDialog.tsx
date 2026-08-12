import * as React from 'react';
import { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { SelectChangeEvent } from '@mui/material/Select';
import { UserDataContext } from '../../../globalState';
import { Button, ButtonItem, BUTTON_TYPES } from '../../button/Button';
import { OrisoSelect, OrisoSelectOption } from '../../form/OrisoSelect';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../../overlay/Overlay';
import { logout } from '../../logout/logout';
import { mobileListView } from '../../app/navigationHandler';
import { useTranslation } from 'react-i18next';
import { CheckAnimation } from '../../animatedIllustration/AnimatedIllustration';
import { ReactComponent as XIcon } from '../../../resources/img/illustrations/x.svg';
import { AdditionalAgencySelection } from '../AdditionalEnquiry/AdditionalAgencySelection';
import {
	apiGetTenantAgenciesTopics,
	apiPostAdditionalEnquiry,
	FETCH_ERRORS,
	TenantAgenciesTopicsInterface,
	X_REASON
} from '../../../api';

export interface NewRequestDialogProps {
	open: boolean;
	onClose: () => void;
	/** Preselect a topic (e.g. suggested by a consultant) - user can change it. */
	preselectedTopicId?: number;
	/** Prefill the postcode input - user can change it. */
	prefilledPostcode?: string;
	/** Agencies the asker is already in contact with; listed first + badged. */
	knownAgencyIds?: number[];
}

/**
 * Reusable "start a request on another topic" pop-up. Used on the asker
 * profile public-data page; designed to be reopened from consultant-driven
 * forwarding flows (agency chat, live chat) with a preselected topic.
 * Creates a new enquiry via POST /users/askers/session/new - no re-register.
 */
export const NewRequestDialog = ({
	open,
	onClose,
	preselectedTopicId,
	prefilledPostcode,
	knownAgencyIds
}: NewRequestDialogProps) => {
	const { t: translate } = useTranslation(['common', 'consultingTypes']);
	const navigate = useNavigate();

	const { reloadUserData } = useContext(UserDataContext);
	const [isButtonDisabled, setIsButtonDisabled] = useState(true);
	const [selectedTopicId, setSelectedTopicId] = useState<number>(
		preselectedTopicId ?? null
	);
	const [selectedAgency, setSelectedAgency] = useState<any>({});
	const [selectedPostcode, setSelectedPostcode] = useState<any>('');
	const [overlayActive, setOverlayActive] = useState(false);
	const [overlayItem, setOverlayItem] = useState<OverlayItem>(null);
	const [sessionId, setSessionId] = useState(null);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [tenantAgenciesTopics, setTenantAgenciesTopics] = useState<
		TenantAgenciesTopicsInterface[]
	>([]);
	const [currentSelectOption, setCurrentSelectOption] = useState(
		preselectedTopicId != null ? preselectedTopicId.toString() : ''
	);

	const buttonSetRegistration: ButtonItem = {
		label: translate('profile.data.register.button.label'),
		type: BUTTON_TYPES.PRIMARY
	};

	const overlayItemNewRegistrationSuccess: OverlayItem = {
		svg: CheckAnimation,
		headline: translate('profile.data.registerSuccess.overlay.headline'),
		buttonSet: [
			{
				label: translate(
					'profile.data.registerSuccess.overlay.button1.label'
				),
				function: OVERLAY_FUNCTIONS.REDIRECT,
				type: BUTTON_TYPES.PRIMARY
			},
			{
				label: translate(
					'profile.data.registerSuccess.overlay.button2.label'
				),
				function: OVERLAY_FUNCTIONS.LOGOUT,
				type: BUTTON_TYPES.LINK
			}
		]
	};

	const overlayItemNewRegistrationError: OverlayItem = {
		svg: XIcon,
		illustrationBackground: 'error',
		headline: translate('profile.data.registerError.overlay.headline'),
		buttonSet: [
			{
				label: translate(
					'profile.data.registerError.overlay.button.label'
				),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.PRIMARY
			}
		]
	};

	useEffect(() => {
		if (!open) {
			return;
		}
		apiGetTenantAgenciesTopics()
			.then((response) => {
				setTenantAgenciesTopics(response);
			})
			.catch(() => {
				setTenantAgenciesTopics([]);
			});
	}, [open]);

	const isAllRequiredDataSet = () =>
		selectedTopicId != null && selectedAgency && selectedPostcode;

	useEffect(() => {
		setIsButtonDisabled(!isAllRequiredDataSet());
	}, [selectedAgency]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleConsultingTypeSelect = (event: SelectChangeEvent<string>) => {
		const topicId = event.target.value;
		setSelectedTopicId(parseInt(topicId));
		setCurrentSelectOption(topicId);
	};

	const topicOptions: OrisoSelectOption[] = tenantAgenciesTopics.map(
		(option) => ({
			value: option.id.toString(),
			label: option.name
		})
	);

	const handleRegistration = () => {
		if (isRequestInProgress || !isAllRequiredDataSet()) {
			return;
		}
		setIsRequestInProgress(true);

		apiPostAdditionalEnquiry(
			selectedAgency.consultingType,
			selectedAgency.id,
			selectedPostcode,
			selectedTopicId
		)
			.then((response) => {
				setSessionId(response.sessionId);
				setOverlayItem(overlayItemNewRegistrationSuccess);
				setOverlayActive(true);
				setIsRequestInProgress(false);
			})
			.catch((error: Response) => {
				const reason = error.headers?.get(FETCH_ERRORS.X_REASON);
				if (
					reason ===
					X_REASON.USER_ALREADY_REGISTERED_WITH_AGENCY_AND_TOPIC
				) {
					// clone - never mutate the shared overlay item object
					setOverlayItem({
						...overlayItemNewRegistrationError,
						headline: translate(
							'profile.data.registerError.overlay.xReasonAlreadyRegistered'
						)
					});
				} else {
					setOverlayItem(overlayItemNewRegistrationError);
				}
				setIsButtonDisabled(true);
				setOverlayActive(true);
				setIsRequestInProgress(false);
			});
	};

	const handleOverlayAction = (buttonFunction: string) => {
		reloadUserData().catch(() => {
			// non-fatal: the next mount refetches user data anyway
		});

		if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			mobileListView();
			onClose();
			/* Normal session view (same screen consultants see from the
			   enquiry list) rather than the /write/ formulation helper -
			   the asker lands in a regular chat surface with the message
			   composer, matching the behaviour of an enquiry picked from
			   the list. */
			navigate({
				pathname: sessionId
					? `/sessions/user/view/session/${sessionId}`
					: `/sessions/user/view`
			});
		} else if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setOverlayItem(null);
			setOverlayActive(false);
			setSelectedTopicId(preselectedTopicId ?? null);
		} else {
			logout();
		}
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			maxWidth="sm"
			aria-labelledby="new-request-dialog-title"
		>
			<DialogTitle id="new-request-dialog-title">
				{translate('profile.data.register.dialog.title')}
				<IconButton
					aria-label={translate('profile.data.register.dialog.close')}
					onClick={onClose}
					sx={{ position: 'absolute', right: 8, top: 8 }}
				>
					<CloseRoundedIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent>
				<OrisoSelect
					id="topicSelect"
					label={translate(
						'profile.data.register.consultingTypeSelect.label'
					)}
					options={topicOptions}
					value={currentSelectOption}
					onChange={handleConsultingTypeSelect}
				/>
				{selectedTopicId !== null && (
					<AdditionalAgencySelection
						selectedTopicId={selectedTopicId}
						initialPostcode={prefilledPostcode}
						knownAgencyIds={knownAgencyIds}
						onAgencyChange={(agency) => setSelectedAgency(agency)}
						onPostcodeChange={(postcode) =>
							setSelectedPostcode(postcode)
						}
					/>
				)}
				<Button
					item={buttonSetRegistration}
					buttonHandle={handleRegistration}
					disabled={isButtonDisabled}
				/>
				{overlayActive && (
					<Overlay
						item={overlayItem}
						handleOverlay={handleOverlayAction}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
};
