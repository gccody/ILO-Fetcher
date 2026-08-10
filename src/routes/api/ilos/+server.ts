import { apiJson, getCatalog, serializeIloSummary } from '$lib/server/ilo-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const ilos = getCatalog().ilos.map(serializeIloSummary);

	return apiJson({ count: ilos.length, ilos });
};
