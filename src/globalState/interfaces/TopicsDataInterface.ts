export interface TopicsDataInterface {
	id: number;
	name: string;
	slug: string;
	description: string;
	internalIdentifier: string;
	status: string;
	createDate: string;
	updateDate: string;
	fallbackUrl: string;
	/** Set by a ConsultingTypeService that ships the topic catalogue: a shipped path or an uploaded data URL. */
	icon?: string | null;
	titles: {
		short: string;
		long: string;
		registrationDropdown: string;
		welcome: string;
	};
}
