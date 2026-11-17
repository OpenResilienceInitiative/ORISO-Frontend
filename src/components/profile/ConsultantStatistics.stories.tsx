import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import {
	ApiGetConsultantStatisticsInterface,
	ConsultantStatisticsDTO
} from '../../api/apiGetConsultantStatistics';
import { ConsultantStatistics } from './ConsultantStatistics';
import './profile.styles';

/**
 * ORISO-Frontend#2299: "Meine Statistik" in the counsellor's profile
 * (Mein Profil → Meine Aktivitäten). Realised appointments by kind plus the
 * cancelled ones, consultations and messages for a week, month or year; the
 * CSV holds one row per day, week or month and a total row. Sample figures,
 * answered the way the UserService endpoint answers.
 */

const SAMPLE = {
	numberOfAssignedSessions: 4,
	numberOfActiveSessions: 11,
	numberOfSentMessages: 86,
	numberOfAppointments: 9,
	numberOfVideoAppointments: 4,
	numberOfPhoneAppointments: 2,
	numberOfOnsiteAppointments: 2,
	numberOfChatAppointments: 1,
	numberOfCancelledAppointments: 1
};

const sampleStatistics = async ({
	startDate,
	endDate
}: ApiGetConsultantStatisticsInterface): Promise<ConsultantStatisticsDTO> => ({
	startDate,
	endDate,
	...SAMPLE,
	breakdown: [{ startDate, endDate, ...SAMPLE }]
});

const emptyStatistics = async ({
	startDate,
	endDate
}: ApiGetConsultantStatisticsInterface): Promise<ConsultantStatisticsDTO> => ({
	startDate,
	endDate,
	numberOfAssignedSessions: 0,
	numberOfActiveSessions: 0,
	numberOfSentMessages: 0
});

const meta: Meta<typeof ConsultantStatistics> = {
	title: 'Profile/ConsultantStatistics',
	component: ConsultantStatistics,
	parameters: { layout: 'padded' },
	decorators: [
		(Story) => (
			<div className="profile__content" style={{ maxWidth: 720 }}>
				<Story />
			</div>
		)
	]
};
export default meta;

type Story = StoryObj<typeof ConsultantStatistics>;

export const WithFigures: Story = {
	name: 'Month with appointments, consultations and messages',
	args: { loadStatistics: sampleStatistics },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => expect(canvas.getByText('86')).toBeTruthy());
		expect(canvas.getByText('9')).toBeTruthy();
	}
};

export const OlderBackend: Story = {
	name: 'Backend without appointment figures: tiles show 0',
	args: { loadStatistics: emptyStatistics }
};
