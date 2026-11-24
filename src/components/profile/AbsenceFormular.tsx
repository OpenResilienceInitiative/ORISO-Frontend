import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiSetAbsence } from '../../api';
import { BUTTON_TYPES } from '../button/Button';
import { OverlayItem, OVERLAY_FUNCTIONS, Overlay } from '../overlay/Overlay';
import { UserDataContext } from '../../globalState';
import { CheckAnimation } from '../animatedIllustration/AnimatedIllustration';
import './absenceFormular.styles';
import { Headline } from '../headline/Headline';
import { Switch } from '../Switch';
import { Text } from '../text/Text';
import { Textarea } from '../form/textarea';
import { isMobile } from 'react-device-detect';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import { OrisoDatePicker } from '../form/OrisoDatePicker';

const DAY = 'YYYY-MM-DD';
const dayOf = (value?: string | null) => (value ? dayjs(value, DAY) : null);

export const AbsenceFormular = () => {
	const { t: translate, i18n } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);

	const [absentMessage, setAbsentMessage] = useState(userData.absenceMessage);
	const [overlayActive, setOverlayActive] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);

	// Absent today, or planned with a first day still ahead
	// (ORISO-Frontend#2303): either way the absence is switched on.
	const isAbsentToday = !!userData.absent;
	const isPlanned = !isAbsentToday && !!userData.absenceStart;
	const isAbsent = useMemo(
		() => isAbsentToday || isPlanned,
		[isAbsentToday, isPlanned]
	);
	const [from, setFrom] = useState<Dayjs | null>(
		dayOf(userData.absenceStart)
	);
	const [until, setUntil] = useState<Dayjs | null>(
		dayOf(userData.absenceEnd)
	);
	const invalidRange = !!from && !!until && until.isBefore(from, 'day');
	const formatDay = (value: string) =>
		new Intl.DateTimeFormat(i18n.language, {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(dayjs(value, DAY).toDate());

	const absenceOverlayItem: OverlayItem = {
		svg: CheckAnimation,
		headline: translate('absence.overlay.changeSuccess.headline'),
		buttonSet: [
			{
				label: translate('absence.overlay.changeSuccess.buttonLabel'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.AUTO_CLOSE
			}
		]
	};

	const saveAbsence = useCallback(
		(isAbsent) => {
			if (isRequestInProgress) {
				return null;
			}
			setIsRequestInProgress(true);

			// Switching off ends the absence together with its days.
			apiSetAbsence(isAbsent, absentMessage, {
				start: isAbsent && from ? from.format(DAY) : null,
				end: isAbsent && until ? until.format(DAY) : null
			})
				.then(reloadUserData)
				.then(() => {
					setOverlayActive(true);
					setIsRequestInProgress(false);
				})
				.catch((error) => {
					// console.log(error);
					setIsRequestInProgress(false);
				});
		},
		[absentMessage, from, until, isRequestInProgress, reloadUserData]
	);

	useEffect(() => {
		setAbsentMessage(userData.absenceMessage);
		setFrom(dayOf(userData.absenceStart));
		setUntil(dayOf(userData.absenceEnd));
	}, [userData]);

	const handleOverlayAction = () => {
		setOverlayActive(false);
	};

	return (
		<div id="absenceForm" className="absenceForm">
			<div className="profile__content__title">
				<Headline
					text={translate('profile.functions.absence.title')}
					semanticLevel="5"
				/>
			</div>
			<div className="generalInformation">
				<Textarea
					value={absentMessage ?? ''}
					onChange={({ target: { value } }) =>
						setAbsentMessage(value)
					}
					placeholder={
						isAbsent
							? translate(
									'profile.functions.absence.activated.label'
								)
							: translate('profile.functions.absence.label')
					}
					disabled={isAbsent}
					className={`${isAbsent ? 'disabled' : ''} ${
						isMobile && isAbsent ? 'mobile' : ''
					}`}
				/>

				<Text
					text={translate('absence.input.infoText')}
					type="infoLargeAlternative"
				/>

				<div className="absenceForm__dates">
					<OrisoDatePicker
						label={translate('profile.functions.absence.from')}
						value={from}
						onChange={setFrom}
						disabled={isAbsent}
						weekStart={1}
					/>
					<OrisoDatePicker
						label={translate('profile.functions.absence.until')}
						value={until}
						onChange={setUntil}
						minDate={from ?? undefined}
						disabled={isAbsent}
						weekStart={1}
					/>
				</div>
				{invalidRange ? (
					<Text
						text={translate(
							'profile.functions.absence.invalidRange'
						)}
						type="infoLargeAlternative"
						className="absenceForm__error"
					/>
				) : isPlanned && userData.absenceStart ? (
					<Text
						text={translate('profile.functions.absence.planned', {
							start: formatDay(userData.absenceStart)
						})}
						type="infoLargeAlternative"
						className="absenceForm__status"
					/>
				) : isAbsentToday && userData.absenceEnd ? (
					<Text
						text={translate(
							'profile.functions.absence.activeUntil',
							{
								end: formatDay(userData.absenceEnd)
							}
						)}
						type="infoLargeAlternative"
						className="absenceForm__status"
					/>
				) : (
					<Text
						text={translate('profile.functions.absence.dateHint')}
						type="infoLargeAlternative"
					/>
				)}

				<div className="flex">
					<Switch
						className="mr--1"
						onChange={() => saveAbsence(!isAbsent)}
						checked={isAbsent}
						disabled={invalidRange || isRequestInProgress}
						aria-label={translate('absence.checkbox.label')}
					/>
					<Text
						text={translate('absence.checkbox.label')}
						type="standard"
					/>
				</div>
			</div>
			{overlayActive && (
				<Overlay
					item={absenceOverlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</div>
	);
};
