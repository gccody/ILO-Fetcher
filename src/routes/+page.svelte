<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Extract ILOs from the data - use $derived to react to data changes
	let ilos = $derived(data.data.ilos);

	// Use the initial expanded sections from server (all collapsed)
	// $derived.by allows us to reference data without the warning since we explicitly
	// compute the initial state and return a mutable reference
	let expandedSections = $derived.by(() => {
		// Create a mutable copy of the server-provided initial state
		const state: Record<string, boolean> = {};
		for (const key in data.expandedSections) {
			state[key] = data.expandedSections[key];
		}
		return state;
	});

	function toggleSection(version: string) {
		expandedSections[version] = !expandedSections[version];
	}

	function getRequirementBadgeClass(requirement: string): string {
		switch (requirement) {
			case 'Critical':
				return 'badge-critical';
			case 'Recommended':
				return 'badge-recommended';
			default:
				return 'badge-optional';
		}
	}

	function getReleaseTypeBadgeClass(releaseType: string): string {
		switch (releaseType) {
			case 'Beta':
				return 'badge-beta';
			case 'Alpha':
				return 'badge-alpha';
			default:
				return 'bg-blue-100 text-blue-800 border-blue-200';
		}
	}

	function getIloColor(version: string): string {
		const colors: Record<string, string> = {
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

<div class="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
	<!-- Header -->
	<header class="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-gradient-to-br from-hpe-green to-hpe-blue rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<div>
						<h1 class="text-2xl font-bold text-slate-900">ILO Firmware Fetcher</h1>
						<p class="text-sm text-slate-500">HPE Integrated Lights-Out Firmware Downloads</p>
					</div>
				</div>
				<div class="hidden sm:flex items-center gap-2 text-sm text-slate-600">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					<span>{ilos.reduce((acc: number, ilo: any) => acc + ilo.files.length, 0)} firmwares available</span>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
		<div class="space-y-6">
			{#each ilos as ilo}
				<!-- ILO Version Section -->
				{@const isExpanded = expandedSections[ilo.version] ?? false}
				<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
					<!-- Section Header -->
					<button
						class="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
						onclick={() => toggleSection(ilo.version)}
					>
						<div class="flex items-center gap-4">
							<div class="{getIloColor(ilo.version)} w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
								{ilo.version.replace('ILO', '')}
							</div>
							<div class="text-left">
								<h2 class="text-xl font-semibold text-slate-900">{ilo.version}</h2>
								<p class="text-sm text-slate-500">{ilo.files.length} firmware versions</p>
							</div>
						</div>
						<div class="flex items-center gap-3">
							{#if ilo.files.length > 0}
								<span class="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-600">
									Latest: {ilo.files[0]!.releaseInfo.version.versionCode}
								</span>
							{/if}
							<svg 
								class="w-5 h-5 text-slate-400 transition-transform duration-200" 
								class:rotate-180={isExpanded}
								fill="none" 
								stroke="currentColor" 
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</div>
					</button>

					<!-- Firmware List -->
					{#if isExpanded}
						<div class="border-t border-slate-200">
							<!-- Table Header -->
							<div class="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
								<div class="col-span-2">Version</div>
								<div class="col-span-2">Release Date</div>
								<div class="col-span-2">Type</div>
								<div class="col-span-2">Size</div>
								<div class="col-span-2">Requirement</div>
								<div class="col-span-2 text-right">Action</div>
							</div>

							<!-- Firmware Rows -->
							<div class="divide-y divide-slate-100">
								{#each ilo.files as file, index}
									<div class="firmware-card p-4 md:px-6 md:py-4 {index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}">
										<!-- Mobile Layout -->
										<div class="md:hidden space-y-3">
											<div class="flex items-start justify-between">
												<div>
													<span class="font-semibold text-slate-900">{file.releaseInfo.version.versionCode}</span>
													<span class="ml-2 text-xs px-2 py-0.5 rounded-full {getReleaseTypeBadgeClass(file.releaseInfo.version.releaseType)}">
														{file.releaseInfo.version.releaseType}
													</span>
												</div>
												<a
													href={file.downloadUrl}
													target="_blank"
													rel="noopener noreferrer"
													class="flex items-center gap-1 px-3 py-1.5 bg-hpe-green hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
													</svg>
													Download
												</a>
											</div>
											<div class="grid grid-cols-2 gap-2 text-sm">
												<div>
													<span class="text-slate-500">Date:</span>
													<span class="ml-1 text-slate-700">{file.releaseInfo.releaseDate}</span>
												</div>
												<div>
													<span class="text-slate-500">Size:</span>
													<span class="ml-1 text-slate-700">{file.fileInfo.filesize}</span>
												</div>
												<div>
													<span class="text-slate-500">File:</span>
													<span class="ml-1 text-slate-700">{file.fileInfo.filename}.{file.fileInfo.filetype}</span>
												</div>
												<div>
													<span class="text-slate-500">Type:</span>
													<span class="ml-1 {getRequirementBadgeClass(file.releaseInfo.upgradeRequirement)} px-2 py-0.5 rounded-full text-xs border">
														{file.releaseInfo.upgradeRequirement}
													</span>
												</div>
											</div>
										</div>

										<!-- Desktop Layout -->
										<div class="hidden md:grid md:grid-cols-12 gap-4 items-center">
											<div class="col-span-2">
												<span class="font-semibold text-slate-900">{file.releaseInfo.version.versionCode}</span>
												<span class="ml-2 text-xs px-2 py-0.5 rounded-full {getReleaseTypeBadgeClass(file.releaseInfo.version.releaseType)}">
													{file.releaseInfo.version.releaseType}
												</span>
											</div>
											<div class="col-span-2 text-slate-600">
												{file.releaseInfo.releaseDate}
											</div>
											<div class="col-span-2">
												<span class="text-slate-600">{file.fileInfo.filetype.toUpperCase()}</span>
											</div>
											<div class="col-span-2 text-slate-600">
												{file.fileInfo.filesize}
											</div>
											<div class="col-span-2">
												<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border {getRequirementBadgeClass(file.releaseInfo.upgradeRequirement)}">
													{file.releaseInfo.upgradeRequirement}
												</span>
											</div>
											<div class="col-span-2 text-right">
												<a
													href={file.downloadUrl}
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-1 px-4 py-2 bg-hpe-green hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
													</svg>
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

	<!-- Footer -->
	<footer class="bg-white border-t border-slate-200 mt-auto">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<p class="text-center text-sm text-slate-500">
				ILO Firmware Fetcher &copy; {new Date().getFullYear()}
			</p>
		</div>
	</footer>
</div>
