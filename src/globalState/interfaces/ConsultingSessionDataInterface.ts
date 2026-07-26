import { TopicsDataInterface } from './TopicsDataInterface';

export interface ConsultingSessionDataInterface {
	age: number;
	agencyId: number;
	askerId: string;
	askerMatrixUserId: string;
	askerUserName: string;
	consultantId: string;
	consultantMatrixUserId: string;
	consultingType: number;
	counsellingRelation: string;
	gender: string;
	matrixRoomId: string;
	id: number;
	mainTopic: TopicsDataInterface;
	postcode: string;
	topics: TopicsDataInterface[];
}
