<script>
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { readSheetAsObjects, appendRows, updateRange, findRowById, deleteRow, getSheetGid } from '$lib/sheets.js';
	import { SHEET_NAMES, generateId } from '$lib/config.js';
	import { loading, showError } from '$lib/stores.js';

	let clients = $state([]);
	let showForm = $state(false);
	let editingId = $state(null);
	let form = $state({ name: '', contact: '', meterNumber: '', status: 'Active', notes: '' });

	onMount(() => loadClients());

	async function loadClients() {
		$loading = true;
		try {
			const { rows } = await readSheetAsObjects(SHEET_NAMES.ELECTRICITY_CLIENTS);
			clients = rows;
		} catch (e) {
			showError('Failed to load clients: ' + e.message);
		} finally {
			$loading = false;
		}
	}

	function resetForm() {
		form = { name: '', contact: '', meterNumber: '', status: 'Active', notes: '' };
		editingId = null;
		showForm = false;
	}

	function editClient(client) {
		form = {
			name: client.Name || '',
			contact: client.Contact || '',
			meterNumber: client.MeterNumber || '',
			status: client.Status || 'Active',
			notes: client.Notes || ''
		};
		editingId = client.ID;
		showForm = true;
	}

	async function saveClient() {
		if (!form.name) {
			showError('Name is required');
			return;
		}

		$loading = true;
		try {
			if (editingId) {
				const rowNum = await findRowById(SHEET_NAMES.ELECTRICITY_CLIENTS, editingId);
				if (rowNum === -1) throw new Error('Client not found');
				const range = `${SHEET_NAMES.ELECTRICITY_CLIENTS}!A${rowNum}:F${rowNum}`;
				await updateRange(range, [[editingId, form.name, form.contact, form.meterNumber, form.status, form.notes]]);
			} else {
				const id = generateId();
				await appendRows(SHEET_NAMES.ELECTRICITY_CLIENTS, [[id, form.name, form.contact, form.meterNumber, form.status, form.notes]]);
			}
			resetForm();
			await loadClients();
		} catch (e) {
			showError('Failed to save: ' + e.message);
		} finally {
			$loading = false;
		}
	}

	async function deleteClient(id) {
		if (!confirm('Delete this client? This cannot be undone.')) return;

		$loading = true;
		try {
			const gid = await getSheetGid(SHEET_NAMES.ELECTRICITY_CLIENTS);
			const rowNum = await findRowById(SHEET_NAMES.ELECTRICITY_CLIENTS, id);
			if (rowNum === -1) throw new Error('Client not found');
			await deleteRow(gid, rowNum - 1);
			await loadClients();
		} catch (e) {
			showError('Failed to delete: ' + e.message);
		} finally {
			$loading = false;
		}
	}
</script>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-800">Electricity</h1>
		<p class="text-sm text-gray-500">Manage clients and meter readings</p>
	</div>
	<div class="flex gap-2">
		<a
			href="{base}/electricity/bills"
			class="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
		>
			Bills
		</a>
		<button
			onclick={() => { resetForm(); showForm = true; }}
			class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
		>
			+ Add Client
		</button>
	</div>
</div>

<!-- Form Modal -->
{#if showForm}
	<div class="fixed inset-0 bg-black/40 z-40 flex items-start justify-center pt-20 px-4" role="presentation" onclick={() => resetForm()}>
		<div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6" role="presentation" onclick={(e) => e.stopPropagation()}>
			<h2 class="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Client</h2>
			<form onsubmit={(e) => { e.preventDefault(); saveClient(); }} class="space-y-3">
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700">Name *</label>
					<input id="name" bind:value={form.name} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="contact" class="block text-sm font-medium text-gray-700">Contact</label>
						<input id="contact" bind:value={form.contact} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
					</div>
					<div>
						<label for="meter" class="block text-sm font-medium text-gray-700">Meter Number</label>
						<input id="meter" bind:value={form.meterNumber} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none" />
					</div>
				</div>
				<div>
					<label for="status" class="block text-sm font-medium text-gray-700">Status</label>
					<select id="status" bind:value={form.status} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none">
						<option>Active</option>
						<option>Inactive</option>
					</select>
				</div>
				<div>
					<label for="notes" class="block text-sm font-medium text-gray-700">Notes</label>
					<textarea id="notes" bind:value={form.notes} rows="2" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"></textarea>
				</div>
				<div class="flex justify-end gap-2 pt-2">
					<button type="button" onclick={resetForm} class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer">Cancel</button>
					<button type="submit" class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 cursor-pointer">
						{editingId ? 'Update' : 'Add'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Clients List -->
{#if $loading && clients.length === 0}
	<p class="text-gray-400 text-sm">Loading...</p>
{:else if clients.length === 0}
	<p class="text-gray-400 text-sm">No clients yet. Add one to get started.</p>
{:else}
	<div class="space-y-3">
		{#each clients as client}
			<div class="bg-white rounded-lg border border-gray-200 p-4">
				<div class="flex items-start justify-between">
					<div>
						<div class="flex items-center gap-2">
							<h3 class="font-semibold text-gray-800">{client.Name}</h3>
							<span class="text-xs px-2 py-0.5 rounded-full {client.Status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
								{client.Status}
							</span>
						</div>
						{#if client.MeterNumber}
							<p class="text-sm text-gray-500 mt-1">Meter: {client.MeterNumber}</p>
						{/if}
						{#if client.Contact}
							<p class="text-sm text-gray-500">Contact: {client.Contact}</p>
						{/if}
					</div>
					<div class="flex items-center gap-1 ml-2 shrink-0">
						<button onclick={() => editClient(client)} class="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-700 cursor-pointer">Edit</button>
						<button onclick={() => deleteClient(client.ID)} class="text-xs px-2 py-1.5 text-red-400 hover:text-red-600 cursor-pointer">Delete</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
