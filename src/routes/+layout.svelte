<script lang="ts">
	import "../app.css";
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<script>
		// Force dark mode immediately
		document.documentElement.classList.add('dark');
		document.documentElement.style.colorScheme = 'dark';
	</script>
</svelte:head>

{@render children()}