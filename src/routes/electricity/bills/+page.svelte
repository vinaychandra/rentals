<script>
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { readSheetAsObjects, updateRange, findRowById } from '$lib/sheets.js';
	import { SHEET_NAMES, PAYMENT_METHODS, formatINR } from '$lib/config.js';
	import { loading, showError } from '$lib/stores.js';

	let bills = $state([]);
	let clients = $state([]);
	let readings = $state([]);
	let elecPayments = $state([]);

	// Payment modal state
	let payingRecord = $state(null);
	let payForm = $state({ amount: '', method: PAYMENT_METHODS[0], date: new Date().toISOString().split('T')[0] });

	onMount(() => loadAll());

	async function loadAll() {
		$loading = true;
		try {
			const [billData, clientData, readingData, paymentData] = await Promise.all([
				readSheetAsObjects(SHEET_NAMES.ELECTRICITY_BILLS),
				readSheetAsObjects(SHEET_NAMES.ELECTRICITY_CLIENTS),
				readSheetAsObjects(SHEET_NAMES.METER_READINGS),
				readSheetAsObjects(SHEET_NAMES.ELECTRICITY_PAYMENTS)
			]);
			bills = billData.rows.sort((a, b) => b.Month.localeCompare(a.Month));
			clients = clientData.rows;
			readings = readingData.rows;
			elecPayments = paymentData.rows;
		} catch (e) {
			showError('Failed to load data: ' + e.message);
		} finally {
			$loading = false;
		}
	}

	function clientName(clientId) {
		return clients.find((c) => c.ID === clientId)?.Name || 'Unknown';
	}

	function billReadings(billId) {
		return readings.filter((r) => r.BillID === billId);
	}

	function billPayments(billId) {
		return elecPayments.filter((p) => p.BillID === billId);
	}

	function openPayModal(payment) {
		payingRecord = payment;
		payForm = {
			amount: String(Number(payment.AmountDue) - Number(payment.AmountPaid || 0)),
			method: PAYMENT_METHODS[0],
			date: new Date().toISOString().split('T')[0]
		};
	}

	async function savePayment() {
		if (!payForm.amount || !payForm.date) {
			showError('Amount and Date are required');
			return;
		}

		$loading = true;
		try {
			const rowNum = await findRowById(SHEET_NAMES.ELECTRICITY_PAYMENTS, payingRecord.ID);
			if (rowNum === -1) throw new Error('Payment record not found');

			const newPaid = Number(payingRecord.AmountPaid || 0) + Number(payForm.amount);
			const due = Number(payingRecord.AmountDue);
			const status = newPaid >= due ? 'Paid' : 'Partial';

			const range = `${SHEET_NAMES.ELECTRICITY_PAYMENTS}!A${rowNum}:H${rowNum}`;
			await updateRange(range, [
				[payingRecord.ID, payingRecord.BillID, payingRecord.ClientID, payingRecord.AmountDue, String(newPaid), payForm.method, payForm.date, status]
			]);

			payingRecord = null;
			await loadAll();
		} catch (e) {
			showError('Failed to save payment: ' + e.message);
		} finally {
			$loading = false;
		}
	}
</script>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-800">Electricity Bills</h1>
	</div>
	<div class="flex gap-2">
		<a
			href="{base}/electricity"
			class="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
		>
			Clients
		</a>
		<a
			href="{base}/electricity/bills/new"
			class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
		>
			+ New Bill
		</a>
	</div>
</div>

<!-- Payment Modal -->
{#if payingRecord}
	<div class="fixed inset-0 bg-black/40 z-40 flex items-start justify-center pt-20 px-4" role="presentation" onclick={() => (payingRecord = null)}>
		<div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6" role="presentation" onclick={(e) => e.stopPropagation()}>
			<h2 class="text-lg font-semibold mb-4">Record Payment — {clientName(payingRecord.ClientID)}</h2>
			<p class="text-sm text-gray-500 mb-4">
				Due: {formatINR(Number(payingRecord.AmountDue))} | Paid: {formatINR(Number(payingRecord.AmountPaid || 0))} | Remaining: {formatINR(Number(payingRecord.AmountDue) - Number(payingRecord.AmountPaid || 0))}
			</p>
			<form onsubmit={(e) => { e.preventDefault(); savePayment(); }} class="space-y-3">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="pay-amount" class="block text-sm font-medium text-gray-700">Amount (₹)</label>
						<input id="pay-amount" type="number" bind:value={payForm.amount} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
					</div>
					<div>
						<label for="pay-method" class="block text-sm font-medium text-gray-700">Method</label>
						<select id="pay-method" bind:value={payForm.method} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none">
							{#each PAYMENT_METHODS as m}
								<option value={m}>{m}</option>
							{/each}
						</select>
					</div>
				</div>
				<div>
					<label for="pay-date" class="block text-sm font-medium text-gray-700">Date</label>
					<input id="pay-date" type="date" bind:value={payForm.date} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
				</div>
				<div class="flex justify-end gap-2 pt-2">
					<button type="button" onclick={() => (payingRecord = null)} class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer">Cancel</button>
					<button type="submit" class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 cursor-pointer">Save</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Bills List -->
{#if $loading && bills.length === 0}
	<p class="text-gray-400 text-sm">Loading...</p>
{:else if bills.length === 0}
	<p class="text-gray-400 text-sm">No bills yet. Create one to get started.</p>
{:else}
	<div class="space-y-4">
		{#each bills as bill}
			{@const bReadings = billReadings(bill.ID)}
			{@const bPayments = billPayments(bill.ID)}
			{@const totalPaid = bPayments.reduce((s, p) => s + Number(p.AmountPaid || 0), 0)}
			<div class="bg-white rounded-lg border border-gray-200 p-4">
				<div class="flex items-center justify-between mb-3">
					<div>
						<h3 class="font-semibold text-gray-700">{bill.Month}</h3>
						<p class="text-sm text-gray-500">{bill.Date} {bill.Notes ? `— ${bill.Notes}` : ''}</p>
					</div>
					<div class="text-right">
						<p class="font-semibold text-gray-800">{formatINR(Number(bill.TotalAmount))}</p>
						<p class="text-xs {totalPaid >= Number(bill.TotalAmount) ? 'text-green-600' : 'text-orange-500'}">
							Collected: {formatINR(totalPaid)}
						</p>
					</div>
				</div>

				<!-- Client breakdown -->
				<div class="border-t border-gray-100 pt-2 space-y-2">
					{#each bPayments as payment}
						{@const reading = bReadings.find((r) => r.ClientID === payment.ClientID)}
						{@const remaining = Number(payment.AmountDue) - Number(payment.AmountPaid || 0)}
						<div class="flex items-center justify-between text-sm py-1">
							<div class="min-w-0 flex-1">
								<span class="font-medium text-gray-700">{clientName(payment.ClientID)}</span>
								{#if reading}
									<span class="text-gray-400 ml-1">({reading.Units} units)</span>
								{/if}
								<span class="text-gray-500 ml-1">— {formatINR(Number(payment.AmountDue))}</span>
							</div>
							<div class="flex items-center gap-2 ml-2 shrink-0">
								{#if payment.Status === 'Paid'}
									<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
								{:else if payment.Status === 'Partial'}
									<span class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
										Partial ({formatINR(Number(payment.AmountPaid || 0))})
									</span>
									<button onclick={() => openPayModal(payment)} class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer">
										Pay {formatINR(remaining)}
									</button>
								{:else}
									<span class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Unpaid</span>
									<button onclick={() => openPayModal(payment)} class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer">
										Record Payment
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
