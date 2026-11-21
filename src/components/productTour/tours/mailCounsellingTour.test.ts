import { describe } from 'vite-plus/test';
import { consultantMailCounsellingTour } from '../tourDefinitions';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

// The mail-counselling tour is offered again (FE#2340); it keeps the same
// contract as the new use-case tours.
describe('consultant-mail-counselling', () => {
	itKeepsTheTourContract(consultantMailCounsellingTour, 'consultant');
});
