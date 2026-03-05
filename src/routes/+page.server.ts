import data from '$lib/assets/data.json';
import type { Data } from '../types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	let iloCount = 0;
	// Initialize all ILO sections as collapsed
	const initialExpandedSections: Record<string, boolean> = {};
	(data as Data).ilos.forEach((ilo) => {
		initialExpandedSections[ilo.version] = false;
		iloCount += ilo.files.length;
	});

	return {
		data: data as Data,
		expandedSections: initialExpandedSections,
		iloCount
	};
};
