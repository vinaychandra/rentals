<script>
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { readSheetAsObjects, appendRows } from '$lib/sheets.js';
	import { SHEET_NAMES, generateId, formatINR } from '$lib/config.js';
	import { loading, showError } from '$lib/stores.js';

	let clients = $state([]);
	let billMonth = $state('');
	let billAmount = $state('');
	let billDate = $state(new Date().toISOString().split('T')[0]);
	let billNotes = $state('');

	/**
	 * @type {Array<{clientId: string, clientName: string, previousReading: string, currentReading: string}>}
	 */
	let readings = $state([]);

	onMount(async () => {
		$loading = true;
		try {
			// Load active clients
			const { rows } = await readSheetAsObjects(SHEET_NAMES.ELECTRICITY_CLIENTS);
			clients = rows.filter((c) => c.Status === 'Active');

			// Load past readings to get last current reading for each client
			const { rows: pastReadings } = await readSheetAsObjects(SHEET_NAMES.METER_READINGS);

			readings = clients.map((c) => {
				// Find the most recent reading for this client
				const clientReadings = pastReadings.filter((r) => r.ClientID === c.ID);
				const lastReading = clientReadings.length > 0 ? clientReadings[clientReadings.length - 1].CurrentReading : '';

				return {
					clientId: c.ID,
					clientName: c.Name,
					previousReading: lastReading,
					currentReading: ''
				};
			});
		} catch (e) {
			showError('Failed to load data: ' + e.message);
		} finally {
			$loading = false;
		}
	});

	// Calculate units and shares reactively
	let calculations = $derived.by(() => {
		const total = Number(billAmount) || 0;
		const items = readings.map((r) => {
			const prev = Number(r.previousReading) || 0;
			const curr = Number(r.currentReading) || 0;
			const units = curr > prev ? curr - prev : 0;
			return { ...r, units };
		});

		const totalUnits = items.reduce((s, i) => s + i.units, 0);

		return items.map((item) => ({
			...item,
			share: totalUnits > 0 ? Math.round((item.units / totalUnits) * total) : 0
		}));
	});

	let totalShare = $derived(calculations.reduce((s, c) => s + c.share, 0));
	let totalUnits = $derived(calculations.reduce((s, c) => s + c.units, 0));

	async function saveBill() {
		if (!billMonth || !billAmount || !billDate) {
			showError('Month, Amount, and Date are required');
			return;
		}

		const hasReadings = readings.some((r) => r.currentReading);
		if (!hasReadings) {
			showError('Enter at least one meter reading');
			return;
		}

		$loading = true;
		try {
			const billId = generateId();

			// Save the bill
			await appendRows(SHEET_NAMES.ELECTRICITY_BILLS, [
				[billId, billMonth, billAmount, billDate, billNotes]
			]);

			// Save meter readings
			const readingRows = readings
				.filter((r) => r.currentReading)
				.map((r) => [generateId(), billId, r.clientId, r.previousReading, r.currentReading, String(Number(r.currentReading) - Number(r.previousReading || 0))]);

			if (readingRows.length > 0) {
				await appendRows(SHEET_NAMES.METER_READINGS, readingRows);
			}

			// Save electricity payment records (initially unpaid)
			const total = Number(billAmount) || 0;
			const items = readingRows.map((row) => {
				const units = Number(row[5]);
				const tUnits = readingRows.reduce((s, r) => s + Number(r[5]), 0);
				const share = tUnits > 0 ? Math.round((units / tUnits) * total) : 0;
				return [generateId(), billId, row[2], String(share), '0', '', '', 'Unpaid'];
			});

			if (items.length > 0) {
				await appendRows(SHEET_NAMES.ELECTRICITY_PAYMENTS, items);
			}

			goto(`${base}/electricity/bills`);
		} catch (e) {
			showError('Failed to save bill: ' + e.message);
		} finally {
			$loading = false;
		}
	}
</script>

<div class="mb-4">
	<a href="{base}/electricity/bills" class="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Bills</a>
</div>

<h1 class="text-2xl font-bold text-gray-800 mb-6">New Electricity Bill</h1>

<form onsubmit={(e) => { e.preventDefault(); saveBill(); }} class="space-y-6">
	<!-- Bill Details -->
	<div class="bg-white rounded-lg border border-gray-200 p-4">
		<h2 class="font-semibold text-gray-700 mb-3">Bill Details</h2>
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
			<div>
				<label for="month" class="block text-sm font-medium text-gray-700">Month *</label>
				<input id="month" type="month" bind:value={billMonth} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
			</div>
			<div>
				<label for="amount" class="block text-sm font-medium text-gray-700">Total Bill (₹) *</label>
				<input id="amount" type="number" bind:value={billAmount} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
			</div>
			<div>
				<label for="date" class="block text-sm font-medium text-gray-700">Bill Date *</label>
				<input id="date" type="date" bind:value={billDate} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
			</div>
		</div>
		<div class="mt-3">
			<label for="notes" class="block text-sm font-medium text-gray-700">Notes</label>
			<input id="notes" bind:value={billNotes} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
		</div>
	</div>

	<!-- Meter Readings -->
	<div class="bg-white rounded-lg border border-gray-200 p-4">
		<h2 class="font-semibold text-gray-700 mb-3">Meter Readings</h2>

		{#if readings.length === 0}
			<p class="text-gray-400 text-sm">No active clients. Add clients first.</p>
		{:else}
			<div class="space-y-3">
				{#each readings as reading, i}
					<div class="border border-gray-100 rounded-md p-3">
						<p class="text-sm font-medium text-gray-700 mb-2">{reading.clientName}</p>
						<div class="grid grid-cols-3 gap-2">
							<div>
								<label for="prev-{i}" class="block text-xs text-gray-500">Previous</label>
								<input id="prev-{i}" type="number" bind:value={readings[i].previousReading} class="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none" />
							</div>
							<div>
								<label for="curr-{i}" class="block text-xs text-gray-500">Current *</label>
								<input id="curr-{i}" type="number" bind:value={readings[i].currentReading} class="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none" />
							</div>
							<div>
								<p class="text-xs text-gray-500">Units / Share</p>
								<p class="mt-1 text-sm font-medium text-gray-700 py-1.5">
									{calculations[i]?.units || 0} units — {formatINR(calculations[i]?.share || 0)}
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Summary -->
			{#if billAmount}
				<div class="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-sm">
					<span class="text-gray-500">Total: {totalUnits} units</span>
					<span class="font-medium {totalShare === Number(billAmount) ? 'text-green-600' : 'text-orange-500'}">
						Allocated: {formatINR(totalShare)} / {formatINR(Number(billAmount))}
						{#if totalShare !== Number(billAmount) && totalUnits > 0}
							<span class="text-xs text-gray-400">(rounding diff: {formatINR(Number(billAmount) - totalShare)})</span>
						{/if}
					</span>
				</div>
			{/if}
		{/if}
	</div>

	<div class="flex justify-end">
		<button type="submit" class="bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 cursor-pointer">
			Save Bill
		</button>
	</div>
</form>
