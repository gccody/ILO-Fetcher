import data from '../../data.json';
import type { Data } from '../../types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Initialize all ILO sections as collapsed
	const initialExpandedSections: Record<string, boolean> = {};
	(data as Data).ilos.forEach((ilo) => {
		initialExpandedSections[ilo.version] = false;
	});

	return {
		data: data as Data,
		expandedSections: initialExpandedSections
	};
};
