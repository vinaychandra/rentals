<script>
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { readSheetAsObjects, appendRows, deleteRow, getSheetGid, findRowById } from '$lib/sheets.js';
	import { SHEET_NAMES, PAYMENT_METHODS, generateId, formatINR } from '$lib/config.js';
	import { loading, showError } from '$lib/stores.js';

	const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	let property = $state(null);
	let payments = $state([]);
	let showForm = $state(false);
	// Default to previous month (e.g. March → February rent)
	const prevMonth = new Date().getMonth() || 12; // getMonth() is 0-indexed, so 0 (Jan) becomes 12 (Dec)
	const prevMonthYear = prevMonth === 12 ? new Date().getFullYear() - 1 : new Date().getFullYear();

	let form = $state({
		month: prevMonth,
		year: prevMonthYear,
		amount: '',
		method: PAYMENT_METHODS[0],
		date: new Date().toISOString().split('T')[0],
		notes: ''
	});

	/** Combined YYYY-MM string from form month/year */
	let formMonthKey = $derived(`${form.year}-${String(form.month).padStart(2, '0')}`);

	/** How much has already been paid for the selected month */
	let paidThisMonth = $derived(
		payments
			.filter((p) => p.Month === formMonthKey)
			.reduce((s, p) => s + Number(p.Amount || 0), 0)
	);

	let rent = $derived(Number(property?.MonthlyRent || 0));
	let remaining = $derived(Math.max(0, rent - paidThisMonth));

	$effect(() => {
		const id = $page.params.id;
		if (id) loadData(id);
	});

	async function loadData(propertyId) {
		$loading = true;
		try {
			// Load property details
			const { rows: allProps } = await readSheetAsObjects(SHEET_NAMES.PROPERTIES);
			property = allProps.find((p) => p.ID === propertyId) || null;

			// Load payments for this property
			const { rows: allPayments } = await readSheetAsObjects(SHEET_NAMES.RENTAL_PAYMENTS);
			payments = allPayments
				.filter((p) => p.PropertyID === propertyId)
				.sort((a, b) => {
					// Sort by month desc, then date desc
					if (a.Month !== b.Month) return b.Month.localeCompare(a.Month);
					return b.Date.localeCompare(a.Date);
				});
		} catch (e) {
			showError('Failed to load data: ' + e.message);
		} finally {
			$loading = false;
		}
	}

	function resetForm() {
		form = {
			month: prevMonth,
			year: prevMonthYear,
			amount: '',
			method: PAYMENT_METHODS[0],
			date: new Date().toISOString().split('T')[0],
			notes: ''
		};
		showForm = false;
	}

	async function savePayment() {
		if (!form.month || !form.year || !form.amount || !form.date) {
			showError('Month, Year, Amount, and Date are required');
			return;
		}

		$loading = true;
		try {
			const id = generateId();
			await appendRows(SHEET_NAMES.RENTAL_PAYMENTS, [
				[id, $page.params.id, formMonthKey, form.amount, form.method, form.date, form.notes]
			]);
			resetForm();
			await loadData($page.params.id);
		} catch (e) {
			showError('Failed to save payment: ' + e.message);
		} finally {
			$loading = false;
		}
	}

	async function deletePayment(paymentId) {
		if (!confirm('Delete this payment record?')) return;

		$loading = true;
		try {
			const gid = await getSheetGid(SHEET_NAMES.RENTAL_PAYMENTS);
			const rowNum = await findRowById(SHEET_NAMES.RENTAL_PAYMENTS, paymentId);
			if (rowNum === -1) throw new Error('Payment not found');
			await deleteRow(gid, rowNum - 1);
			await loadData($page.params.id);
		} catch (e) {
			showError('Failed to delete: ' + e.message);
		} finally {
			$loading = false;
		}
	}

	// Group payments by month and calculate totals
	function groupByMonth(paymentList) {
		const groups = {};
		for (const p of paymentList) {
			if (!groups[p.Month]) groups[p.Month] = [];
			groups[p.Month].push(p);
		}
		return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
	}
</script>

<div class="mb-4">
	<a href="{base}/rentals" class="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Properties</a>
</div>

{#if !property && !$loading}
	<p class="text-gray-400">Property not found.</p>
{:else if property}
	<div class="flex items-start justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold text-gray-800">{property.Name}</h1>
			{#if property.Address}
				<p class="text-sm text-gray-500">{property.Address}</p>
			{/if}
			<p class="text-sm text-gray-600 mt-1">Rent: {formatINR(Number(property.MonthlyRent))}/month</p>
			{#if property.TenantName}
				<p class="text-sm text-gray-500">Tenant: {property.TenantName}</p>
			{/if}
		</div>
		<button
			onclick={() => { resetForm(); showForm = true; }}
			class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
		>
			+ Add Payment
		</button>
	</div>

	<!-- Payment Form Modal -->
	{#if showForm}
		<div class="fixed inset-0 bg-black/40 z-40 flex items-start justify-center pt-20 px-4" role="presentation" onclick={() => resetForm()}>
			<div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6" role="presentation" onclick={(e) => e.stopPropagation()}>
				<h2 class="text-lg font-semibold mb-4">Add Payment</h2>
				<form onsubmit={(e) => { e.preventDefault(); savePayment(); }} class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="month" class="block text-sm font-medium text-gray-700">Month *</label>
							<select id="month" bind:value={form.month} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none">
								{#each MONTHS as name, i}
									<option value={i + 1}>{name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="year" class="block text-sm font-medium text-gray-700">Year *</label>
							<input id="year" type="number" bind:value={form.year} min="2020" max="2099" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
						</div>
					</div>

					<!-- Rent summary for selected month -->
					{#if rent > 0}
						<div class="rounded-md bg-gray-50 px-3 py-2 text-sm">
							<span class="text-gray-500">Rent: {formatINR(rent)}</span>
							<span class="mx-1 text-gray-300">|</span>
							<span class="text-gray-500">Paid: {formatINR(paidThisMonth)}</span>
							<span class="mx-1 text-gray-300">|</span>
							<span class="{remaining > 0 ? 'text-orange-500' : 'text-green-600'} font-medium">
								{remaining > 0 ? `Remaining: ${formatINR(remaining)}` : 'Fully paid ✓'}
							</span>
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="amount" class="block text-sm font-medium text-gray-700">Amount (₹) *</label>
							<input id="amount" type="number" bind:value={form.amount} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
						</div>
						<div>
							<label for="method" class="block text-sm font-medium text-gray-700">Method</label>
							<select id="method" bind:value={form.method} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none">
								{#each PAYMENT_METHODS as m}
									<option value={m}>{m}</option>
								{/each}
							</select>
						</div>
					</div>
					<div>
						<label for="date" class="block text-sm font-medium text-gray-700">Date *</label>
						<input id="date" type="date" bind:value={form.date} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
					</div>
					<div>
						<label for="notes" class="block text-sm font-medium text-gray-700">Notes</label>
						<input id="notes" bind:value={form.notes} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
					</div>
					<div class="flex justify-end gap-2 pt-2">
						<button type="button" onclick={resetForm} class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer">Cancel</button>
						<button type="submit" class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 cursor-pointer">Add Payment</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Payment History -->
	{#if $loading && payments.length === 0}
		<p class="text-gray-400 text-sm">Loading payments...</p>
	{:else if payments.length === 0}
		<p class="text-gray-400 text-sm">No payments recorded yet.</p>
	{:else}
		<div class="space-y-4">
			{#each groupByMonth(payments) as [month, monthPayments]}
				{@const total = monthPayments.reduce((s, p) => s + Number(p.Amount || 0), 0)}
				{@const rent = Number(property.MonthlyRent || 0)}
				<div class="bg-white rounded-lg border border-gray-200 p-4">
					<div class="flex items-center justify-between mb-2">
						<h3 class="font-semibold text-gray-700">{month}</h3>
						<span class="text-sm {total >= rent ? 'text-green-600' : 'text-orange-500'} font-medium">
							{formatINR(total)} / {formatINR(rent)}
							{#if total >= rent}
								✓
							{:else}
								(Due: {formatINR(rent - total)})
							{/if}
						</span>
					</div>
					<div class="space-y-1">
						{#each monthPayments as payment}
							<div class="flex items-center justify-between text-sm py-1 border-t border-gray-100">
								<div class="text-gray-600">
									{formatINR(Number(payment.Amount))} via {payment.Method}
									<span class="text-gray-400 ml-1">{payment.Date}</span>
									{#if payment.Notes}
										<span class="text-gray-400 ml-1">— {payment.Notes}</span>
									{/if}
								</div>
								<button onclick={() => deletePayment(payment.ID)} class="text-red-400 hover:text-red-600 text-xs cursor-pointer">Delete</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}
