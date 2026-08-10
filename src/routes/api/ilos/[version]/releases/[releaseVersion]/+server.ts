import { apiError, apiJson, getIlo, serializeRelease } from '$lib/server/ilo-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const ilo = getIlo(params.version);

	if (!ilo) {
		return apiError(404, 'ILO_VERSION_NOT_FOUND', `Unknown iLO version: ${params.version}`);
	}

	const releaseVersion = params.releaseVersion.trim().toLowerCase();
	const index = ilo.files.findIndex(
		(release) => release.releaseInfo.version.versionCode.toLowerCase() === releaseVersion
	);

	if (index === -1) {
		return apiError(
			404,
			'RELEASE_NOT_FOUND',
			`Release ${params.releaseVersion} was not found for ${ilo.version}`
		);
	}

	return apiJson(serializeRelease(ilo, ilo.files[index]!, index));
};
