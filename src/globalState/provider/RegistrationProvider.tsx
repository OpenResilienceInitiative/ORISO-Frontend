import {
	createContext,
	Dispatch,
	PropsWithChildren,
	SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import * as React from 'react';
import { AgencyDataInterface, TopicsDataInterface } from '../interfaces';
import { ConsultingTypeInterface } from '../interfaces/ConsultingTypeInterface';
import { UrlParamsContext } from './UrlParamsProvider';
import { getUrlParameter } from '../../utils/getUrlParameter';
import { apiGetTopicById } from '../../api/apiGetTopicId';
import { apiGetAgencyById, apiGetConsultingType } from '../../api';
import { TopicSelection } from '../../components/registration/topicSelection/TopicSelection';
import { ZipcodeInput } from '../../components/registration/zipcodeInput/ZipcodeInput';
import { AgencySelection } from '../../components/registration/agencySelection/AgencySelection';
import { AccountData } from '../../components/registration/accountData/AccountData';
import {
	mergeRegistrationSteps,
	RegistrationStep,
	filterRegistrationStepsForDirectLink,
	getConsultantDirectLinkTopicIds
} from '../../components/registration/registrationSteps';

export const RegistrationContext = createContext<RegistrationContextInterface>(
	{}
);

interface SessionStorageData {
	username: string;
	password: string;
	agencyId: number;
	mainTopicId: number;
	topicGroupId?: number;
	topicId?: number;
	zipcode: string;
	age?: string;
	state?: string;
}

export interface RegistrationData extends SessionStorageData {
	agency: AgencyDataInterface;
	mainTopic: TopicsDataInterface;
	topic?: TopicsDataInterface;
}

interface RegistrationContextInterface {
	disabledNextButton?: boolean;
	setDisabledNextButton?: Dispatch<SetStateAction<boolean>>;
	registrationData?: RegistrationData;
	updateRegistrationData?: (data: Partial<RegistrationData>) => void;
	registrationConsultingType?: ConsultingTypeInterface | null;
	availableSteps?: RegistrationStep[];
	hasConsultantError?: boolean;
	hasAgencyError?: boolean;
	hasTopicError?: boolean;
}

export const registrationSessionStorageKey = 'registrationData';
const DIRECT_LINK_POSTCODE = '00000';

export function RegistrationProvider({ children }: PropsWithChildren<{}>) {
	const getSessionStorageData = (): SessionStorageData =>
		JSON.parse(
			sessionStorage.getItem(registrationSessionStorageKey) || '{}'
		);
	const setSessionStorageData = (data: Partial<SessionStorageData>) =>
		sessionStorage.setItem(
			registrationSessionStorageKey,
			JSON.stringify(data)
		);

	const [loading, setLoading] = useState<boolean>(true);
	const [disabledNextButton, setDisabledNextButton] = useState<boolean>(true);
	const [hasTopicError, setHasTopicError] = useState<boolean>(false);
	const [hasAgencyError, setHasAgencyError] = useState<boolean>(false);
	const [hasConsultantError, setHasConsultantError] =
		useState<boolean>(false);
	const [registrationData, setRegistrationData] =
		useState<RegistrationData>();
	const [registrationConsultingType, setRegistrationConsultingType] =
		useState<ConsultingTypeInterface | null>(null);
	const previousAgencyIdRef = useRef<number | undefined>(undefined);

	const preselectedTopicId = getUrlParameter('tid');
	const preselectedAgencyId = getUrlParameter('aid');
	const preselectedConsultantId = getUrlParameter('cid');
	const {
		loaded,
		agency: preselectedAgency,
		topic: preselectedTopic,
		zipcode: preselectedZipcode,
		consultant: preselectedConsultant
	} = useContext(UrlParamsContext);

	const getDirectLinkAgency = useCallback(
		(topic?: TopicsDataInterface) => {
			if (!preselectedConsultant) {
				return undefined;
			}

			return (
				preselectedConsultant.agencies.find(
					(agency) => topic?.id && agency.topicIds?.includes(topic.id)
				) || preselectedConsultant.agencies[0]
			);
		},
		[preselectedConsultant]
	);

	// Step URLs are now derived from the route `:step` param in Registration.tsx
	// (react-router v7 removed useRouteMatch), so steps no longer carry a `route`.
	const defaultSteps = useMemo<RegistrationStep[]>(
		() => [
			{
				component: TopicSelection,
				name: 'topic-selection',
				mandatoryFields: ['mainTopic'],
				condition: ({ topic }) => !!topic
			},
			{
				component: ZipcodeInput,
				name: 'zipcode',
				mandatoryFields: ['zipcode'],
				condition: ({ zipcode }) => !!zipcode
			},
			{
				component: AgencySelection,
				name: 'agency-selection',
				mandatoryFields: ['agency'],
				condition: ({ agency }) => !!agency
			},
			{
				component: AccountData,
				name: 'account-data',
				mandatoryFields: ['username', 'password']
			}
		],
		[]
	);
	const [preselectedSteps, setPreselectedSteps] = useState(defaultSteps);
	const [availableSteps, setAvailableSteps] = useState(defaultSteps);

	useEffect(() => {
		const consultingTypeId = registrationData?.agency?.consultingType;

		if (!consultingTypeId) {
			setRegistrationConsultingType(null);
			return;
		}

		let cancelled = false;

		apiGetConsultingType({ consultingTypeId }).then((consultingType) => {
			if (!cancelled) {
				setRegistrationConsultingType(consultingType);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [registrationData?.agency?.consultingType]);

	useEffect(() => {
		setAvailableSteps(
			mergeRegistrationSteps(preselectedSteps, registrationConsultingType)
		);
	}, [preselectedSteps, registrationConsultingType]);

	// Init already stored data from session storage
	useEffect(() => {
		(async () => {
			const registrationData =
				getSessionStorageData() as RegistrationData;

			if (registrationData.mainTopicId) {
				registrationData.mainTopic = await apiGetTopicById(
					registrationData.mainTopicId
				);
			}
			if (registrationData.agencyId) {
				// Load agency
				registrationData.agency = await apiGetAgencyById(
					registrationData.agencyId
				);
			}
			if (registrationData.topicId) {
				registrationData.topic = await apiGetTopicById(
					registrationData.topicId
				);
			}
			setRegistrationData(registrationData);
			setLoading(false);
		})();
	}, []);

	const updateRegistrationData = useCallback(
		(data?: Partial<RegistrationData>) => {
			setRegistrationData((registrationData) => ({
				...registrationData,
				...data
			}));
		},
		[]
	);

	useEffect(() => {
		const { topic, mainTopic, agency, ...sessionStorageData } =
			registrationData || {};

		setSessionStorageData({
			...sessionStorageData,
			topicId: topic?.id,
			mainTopicId: mainTopic?.id,
			agencyId: agency?.id
		});
	}, [registrationData]);

	useEffect(() => {
		// Check if agency matches preselected topic
		const hasTopicError = preselectedTopicId && !preselectedTopic;

		// Check if agency matches preselected topic
		const hasAgencyError =
			preselectedAgencyId && preselectedTopic && !preselectedAgency;

		setHasConsultantError(
			preselectedConsultantId && !preselectedConsultant
		);
		setHasTopicError(hasTopicError);
		setHasAgencyError(hasAgencyError);

		const directLinkAgency =
			preselectedAgency ||
			getDirectLinkAgency(
				registrationData?.mainTopic || preselectedTopic
			);
		const directLinkZipcode =
			preselectedZipcode ||
			(directLinkAgency || preselectedConsultant
				? DIRECT_LINK_POSTCODE
				: undefined);

		updateRegistrationData({
			...(directLinkZipcode ? { zipcode: directLinkZipcode } : {}),
			...(directLinkAgency ? { agency: directLinkAgency } : {}),
			...(preselectedTopic ? { mainTopic: preselectedTopic } : {})
		});

		setPreselectedSteps(
			filterRegistrationStepsForDirectLink(defaultSteps, {
				preselectedConsultantId,
				preselectedConsultant,
				preselectedTopic,
				directLinkAgency,
				directLinkZipcode
			})
		);
	}, [
		updateRegistrationData,
		preselectedAgencyId,
		preselectedConsultantId,
		preselectedTopicId,
		defaultSteps,
		preselectedTopic,
		preselectedAgency,
		preselectedZipcode,
		preselectedConsultant,
		getDirectLinkAgency,
		registrationData?.mainTopic,
		registrationData?.agency
	]);

	useEffect(() => {
		const agencyId = registrationData?.agency?.id;

		if (
			previousAgencyIdRef.current !== undefined &&
			previousAgencyIdRef.current !== agencyId &&
			(registrationData?.age !== undefined ||
				registrationData?.state !== undefined)
		) {
			updateRegistrationData({
				age: undefined,
				state: undefined
			});
		}

		previousAgencyIdRef.current = agencyId;
	}, [
		registrationData?.agency?.id,
		registrationData?.age,
		registrationData?.state,
		updateRegistrationData
	]);

	useEffect(() => {
		if (!preselectedConsultant || preselectedTopic) {
			return;
		}

		const topicIds = getConsultantDirectLinkTopicIds(
			preselectedConsultant,
			registrationData?.agency
		);
		if (topicIds.length !== 1) {
			return;
		}

		if (registrationData?.mainTopic?.id === topicIds[0]) {
			return;
		}

		let cancelled = false;

		apiGetTopicById(topicIds[0]).then((mainTopic) => {
			if (!cancelled && mainTopic) {
				updateRegistrationData({ mainTopic });
			}
		});

		return () => {
			cancelled = true;
		};
	}, [
		preselectedConsultant,
		preselectedTopic,
		registrationData?.agency,
		registrationData?.mainTopic?.id,
		updateRegistrationData
	]);

	const context = useMemo(
		() => ({
			disabledNextButton,
			setDisabledNextButton,
			registrationData,
			updateRegistrationData: updateRegistrationData,
			registrationConsultingType,
			availableSteps,
			hasConsultantError,
			hasAgencyError,
			hasTopicError
		}),
		[
			availableSteps,
			disabledNextButton,
			hasAgencyError,
			hasConsultantError,
			hasTopicError,
			registrationConsultingType,
			registrationData,
			updateRegistrationData
		]
	);

	if (!loaded || loading) return null;

	return (
		<RegistrationContext.Provider value={context}>
			{children}
		</RegistrationContext.Provider>
	);
}
