import { apiJson, getCatalog, serializeRelease } from '$lib/server/ilo-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const releases = getCatalog().ilos.flatMap((ilo) => {
		const latest = ilo.files[0];
		return latest ? [serializeRelease(ilo, latest, 0)] : [];
	});

	return apiJson({ count: releases.length, releases });
};
