import { apiError, apiJson, getIlo, serializeIlo } from '$lib/server/ilo-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const ilo = getIlo(params.version);

	if (!ilo) {
		return apiError(404, 'ILO_VERSION_NOT_FOUND', `Unknown iLO version: ${params.version}`);
	}

	return apiJson(serializeIlo(ilo));
};
