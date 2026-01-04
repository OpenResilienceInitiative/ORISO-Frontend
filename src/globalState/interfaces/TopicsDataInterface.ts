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
	titles: {
		short: string;
		long: string;
		registrationDropdown: string;
		welcome: string;
	};
}
