import data from '$lib/assets/data.json';
import { json } from '@sveltejs/kit';
import type { Data, ILO, ILOFile, ILOVerion } from '../../types';

const catalog = data as Data;

const apiHeaders = {
	'access-control-allow-origin': '*',
	'cache-control': 'public, max-age=300, s-maxage=3600',
	'content-type': 'application/json; charset=utf-8'
};

export function apiJson(body: unknown, init: ResponseInit = {}): Response {
	return json(body, {
		...init,
		headers: {
			...apiHeaders,
			...init.headers
		}
	});
}

export function apiError(status: number, code: string, message: string): Response {
	return apiJson({ error: { code, message } }, { status });
}

export function getCatalog(): Data {
	return catalog;
}

export function getIlo(version: string): ILO | undefined {
	const normalized = normalizeIloVersion(version);
	return catalog.ilos.find((ilo) => ilo.version === normalized);
}

export function normalizeIloVersion(version: string): ILOVerion | undefined {
	const normalized = version.trim().toUpperCase().replace(/[\s_-]/g, '');
	const withPrefix = /^\d+$/.test(normalized) ? `ILO${normalized}` : normalized;

	return catalog.ilos.some((ilo) => ilo.version === withPrefix)
		? (withPrefix as ILOVerion)
		: undefined;
}

export function serializeRelease(
	ilo: ILO,
	release: ILOFile,
	index: number
): ILOFile & { iloVersion: ILOVerion; sourceUrl: string; isLatest: boolean } {
	return {
		iloVersion: ilo.version,
		sourceUrl: ilo.url,
		isLatest: index === 0,
		...release
	};
}

export function serializeIloSummary(ilo: ILO) {
	const latest = ilo.files[0];

	return {
		version: ilo.version,
		sourceUrl: ilo.url,
		releaseCount: ilo.files.length,
		latestRelease: latest ? serializeRelease(ilo, latest, 0) : null
	};
}

export function serializeIlo(ilo: ILO) {
	const releases = ilo.files.map((release, index) => serializeRelease(ilo, release, index));

	return {
		version: ilo.version,
		sourceUrl: ilo.url,
		releaseCount: releases.length,
		latestRelease: releases[0] ?? null,
		previousReleases: releases.slice(1)
	};
}
