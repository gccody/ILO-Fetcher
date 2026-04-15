<script lang="ts">
	import Favicon from '$lib/assets/favicon.svg';
	import type { ILO, ILOVerion } from '../types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Extract ILOs from the data
	let ilos: ILO[] = $derived(data.data.ilos);

	// svelte-ignore state_referenced_locally
	let expandedSections = $state<Record<string, boolean>>({ ...data.expandedSections });

	function toggleSection(version: string) {
		expandedSections[version] = !expandedSections[version];
	}

	function getRequirementBadgeClass(requirement: string): string {
		switch (requirement) {
			case 'Critical':
				return 'bg-red-900/30 text-red-400 border-red-800';
			case 'Recommended':
				return 'bg-blue-900/30 text-blue-400 border-blue-800';
			default:
				return 'bg-slate-800 text-slate-400 border-slate-700';
		}
	}

	function getReleaseTypeBadgeClass(releaseType: string): string {
		switch (releaseType) {
			case 'Beta':
				return 'bg-amber-900/30 text-amber-400 border-amber-800';
			case 'Alpha':
				return 'bg-purple-900/30 text-purple-400 border-purple-800';
			default:
				return 'bg-emerald-900/30 text-emerald-400 border-emerald-800';
		}
	}

	function getIloColor(version: ILOVerion): string {
		const colors: Record<ILOVerion, string> = {
			'ILO1': 'bg-red-600',
			'ILO2': 'bg-orange-500',
			'ILO3': 'bg-yellow-500',
			'ILO4': 'bg-green-500',
			'ILO5': 'bg-teal-500',
			'ILO6': 'bg-blue-500',
			'ILO7': 'bg-indigo-600'
		};
		return colors[version] || 'bg-gray-500';
	}
</script>

<svelte:head>
	<title>ILO Firmware Fetcher</title>
	<meta name="description" content="Download HPE iLO firmware files" />
</svelte:head>

<div class="min-h-screen flex flex-col bg-slate-900 text-slate-100 transition-colors duration-200">
	<!-- Header -->
	<header class="bg-slate-800 border-b border-slate-700 shadow-sm sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10">
						<img src={Favicon} alt="ILO Logo" class="w-full h-full rounded-lg" />
					</div>
					<div>
						<h1 class="text-2xl font-bold text-white">ILO Firmware Fetcher</h1>
						<p class="text-sm text-slate-400">HPE Integrated Lights-Out</p>
					</div>
				</div>
				<div class="hidden sm:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					<span>{data.iloCount} firmwares available</span>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 py-8 w-full">
		<div class="space-y-4">
			{#each ilos as ilo}
				{@const isExpanded = expandedSections[ilo.version]}
				{@const latestFile = ilo.files[0]!}
				<div class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
					<button 
						onclick={() => toggleSection(ilo.version)}
						class="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 cursor-pointer"
					>
						<div class="flex items-center gap-4">
							<div class="{getIloColor(ilo.version)} w-10 h-10 rounded flex items-center justify-center text-white font-bold">
								{ilo.version.replace('ILO', '')}
							</div>
							<span class="font-bold text-white">{ilo.version}</span>
						</div>
						<div class="flex items-center gap-5">
							<a
								href={latestFile.downloadUrl}
								onclick={(e) => e.stopPropagation()}
								class="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
							>
								Download Latest ({latestFile.releaseInfo.version.versionCode}{latestFile.releaseInfo.version.releaseType === "Production" ? "" : latestFile.releaseInfo.version.releaseType})
							</a>
							<svg class="w-5 h-5 text-slate-400 {isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
						</div>
					</button>

					{#if isExpanded}
						<div class="p-4 border-t border-slate-700 bg-slate-900/20">
							<div class="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase">
								<div class="col-span-3">Version</div>
								<div class="col-span-3">Release Date</div>
								<div class="col-span-2">Size</div>
								<div class="col-span-2">Requirement</div>
								<div class="col-span-2 text-right">Action</div>
							</div>

							<div class="divide-y divide-slate-700">
								{#each ilo.files as file, index}
									<div class="p-4 md:px-6 md:py-4 {index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700/20'}">
										<div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
											<div class="md:col-span-3">
												<span class="font-semibold text-white">{file.releaseInfo.version.versionCode}</span>
												<span class="ml-2 text-xs px-2 py-0.5 rounded-full border {getReleaseTypeBadgeClass(file.releaseInfo.version.releaseType)}">
													{file.releaseInfo.version.releaseType}
												</span>
											</div>
											<div class="md:col-span-3 text-slate-400">
												{file.releaseInfo.releaseDate}
											</div>
											<div class="md:col-span-2 text-slate-400">
												{file.fileInfo.filesize}
											</div>
											<div class="md:col-span-2">
												<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border {getRequirementBadgeClass(file.releaseInfo.upgradeRequirement)}">
													{file.releaseInfo.upgradeRequirement}
												</span>
											</div>
											<div class="md:col-span-2 text-right">
												<a
													href={file.downloadUrl}
													class="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
												>
													Download
												</a>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</main>

	<!-- <footer class="bg-slate-800 border-t border-slate-700 mt-auto">
		<div class="max-w-7xl mx-auto px-4 py-6">
			<p class="text-center text-sm text-slate-400">
				ILO Firmware Fetcher &copy; {new Date().getFullYear()}
			</p>
		</div>
	</footer> -->
</div>