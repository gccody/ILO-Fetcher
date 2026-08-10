import { apiError, apiJson, getIlo, serializeRelease } from '$lib/server/ilo-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const ilo = getIlo(params.version);

	if (!ilo) {
		return apiError(404, 'ILO_VERSION_NOT_FOUND', `Unknown iLO version: ${params.version}`);
	}

	const latest = ilo.files[0];
	if (!latest) {
		return apiError(404, 'RELEASE_NOT_FOUND', `No releases are available for ${ilo.version}`);
	}

	return apiJson(serializeRelease(ilo, latest, 0));
};
