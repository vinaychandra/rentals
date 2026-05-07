<script>
	import { base } from '$app/paths';
</script>

<h1 class="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
	<a
		href="{base}/rentals"
		class="block p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
	>
		<h2 class="text-lg font-semibold text-gray-800 mb-1">Rentals</h2>
		<p class="text-sm text-gray-500">Manage properties and track rent payments</p>
	</a>

	<a
		href="{base}/electricity"
		class="block p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
	>
		<h2 class="text-lg font-semibold text-gray-800 mb-1">Electricity</h2>
		<p class="text-sm text-gray-500">Track meter readings, bills, and payments</p>
	</a>
</div>
