import { apiJson, getCatalog } from '$lib/server/ilo-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const base = `${url.origin}/api`;
	const catalog = getCatalog();

	return apiJson({
		name: 'HPE iLO Firmware API',
		version: '1.0.0',
		description: 'Browse HPE iLO generations and their firmware release history.',
		stats: {
			iloVersions: catalog.ilos.length,
			releases: catalog.ilos.reduce((total, ilo) => total + ilo.files.length, 0)
		},
		endpoints: {
			iloVersions: `${base}/ilos`,
			latestReleases: `${base}/ilos/latest`,
			iloVersion: `${base}/ilos/{version}`,
			releases: `${base}/ilos/{version}/releases`,
			latestRelease: `${base}/ilos/{version}/latest`,
			release: `${base}/ilos/{version}/releases/{releaseVersion}`
		}
	});
};
