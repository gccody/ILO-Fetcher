import { apiError, apiJson, getIlo, serializeRelease } from '$lib/server/ilo-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const ilo = getIlo(params.version);

	if (!ilo) {
		return apiError(404, 'ILO_VERSION_NOT_FOUND', `Unknown iLO version: ${params.version}`);
	}

	const releases = ilo.files.map((release, index) => serializeRelease(ilo, release, index));

	return apiJson({
		iloVersion: ilo.version,
		sourceUrl: ilo.url,
		count: releases.length,
		releases
	});
};
