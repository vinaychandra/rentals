<script>
	import { base } from "$app/paths";
	import { onMount } from "svelte";
	import {
		readSheetAsObjects,
		appendRows,
		updateRange,
		findRowById,
		deleteRow,
		getSheetGid,
	} from "$lib/sheets.js";
	import { SHEET_NAMES, generateId } from "$lib/config.js";
	import { loading, showError } from "$lib/stores.js";

	let meters = $state([]);
	let clients = $state([]);

	// Meter form
	let showMeterForm = $state(false);
	let editingMeterId = $state(null);
	let meterForm = $state({
		name: "",
		meterNumber: "",
		location: "",
		status: "Active",
		notes: "",
	});

	// Client form
	let showClientForm = $state(false);
	let editingClientId = $state(null);
	let clientForm = $state({
		name: "",
		meterId: "",
		contact: "",
		meterNumber: "",
		status: "Active",
		notes: "",
	});

	onMount(() => loadAll());

	async function loadAll() {
		$loading = true;
		try {
			const [meterData, clientData] = await Promise.all([
				readSheetAsObjects(SHEET_NAMES.ELECTRICITY_METERS),
				readSheetAsObjects(SHEET_NAMES.ELECTRICITY_CLIENTS),
			]);
			meters = meterData.rows;
			clients = clientData.rows;
		} catch (e) {
			showError("Failed to load data: " + e.message);
		} finally {
			$loading = false;
		}
	}

	function meterName(meterId) {
		return meters.find((m) => m.ID === meterId)?.Name || "Unassigned";
	}

	// --- Meter CRUD ---
	function resetMeterForm() {
		meterForm = {
			name: "",
			meterNumber: "",
			location: "",
			status: "Active",
			notes: "",
		};
		editingMeterId = null;
		showMeterForm = false;
	}

	function editMeter(meter) {
		meterForm = {
			name: meter.Name || "",
			meterNumber: meter.MeterNumber || "",
			location: meter.Location || "",
			status: meter.Status || "Active",
			notes: meter.Notes || "",
		};
		editingMeterId = meter.ID;
		showMeterForm = true;
	}

	async function saveMeter() {
		if (!meterForm.name) {
			showError("Name is required");
			return;
		}
		$loading = true;
		try {
			if (editingMeterId) {
				const rowNum = await findRowById(
					SHEET_NAMES.ELECTRICITY_METERS,
					editingMeterId,
				);
				if (rowNum === -1) throw new Error("Meter not found");
				const range = `${SHEET_NAMES.ELECTRICITY_METERS}!A${rowNum}:F${rowNum}`;
				await updateRange(range, [
					[
						editingMeterId,
						meterForm.name,
						meterForm.meterNumber,
						meterForm.location,
						meterForm.status,
						meterForm.notes,
					],
				]);
			} else {
				const id = generateId();
				await appendRows(SHEET_NAMES.ELECTRICITY_METERS, [
					[
						id,
						meterForm.name,
						meterForm.meterNumber,
						meterForm.location,
						meterForm.status,
						meterForm.notes,
					],
				]);
			}
			resetMeterForm();
			await loadAll();
		} catch (e) {
			showError("Failed to save: " + e.message);
		} finally {
			$loading = false;
		}
	}

	async function deleteMeter(id) {
		if (!confirm("Delete this meter? This cannot be undone.")) return;
		$loading = true;
		try {
			const gid = await getSheetGid(SHEET_NAMES.ELECTRICITY_METERS);
			const rowNum = await findRowById(
				SHEET_NAMES.ELECTRICITY_METERS,
				id,
			);
			if (rowNum === -1) throw new Error("Meter not found");
			await deleteRow(gid, rowNum - 1);
			await loadAll();
		} catch (e) {
			showError("Failed to delete: " + e.message);
		} finally {
			$loading = false;
		}
	}

	// --- Client CRUD ---
	function resetClientForm() {
		clientForm = {
			name: "",
			meterId: meters[0]?.ID || "",
			contact: "",
			meterNumber: "",
			status: "Active",
			notes: "",
		};
		editingClientId = null;
		showClientForm = false;
	}

	function editClient(client) {
		clientForm = {
			name: client.Name || "",
			meterId: client.MeterID || "",
			contact: client.Contact || "",
			meterNumber: client.MeterNumber || "",
			status: client.Status || "Active",
			notes: client.Notes || "",
		};
		editingClientId = client.ID;
		showClientForm = true;
	}

	async function saveClient() {
		if (!clientForm.name || !clientForm.meterId) {
			showError("Name and Main Meter are required");
			return;
		}
		$loading = true;
		try {
			if (editingClientId) {
				const rowNum = await findRowById(
					SHEET_NAMES.ELECTRICITY_CLIENTS,
					editingClientId,
				);
				if (rowNum === -1) throw new Error("Client not found");
				const range = `${SHEET_NAMES.ELECTRICITY_CLIENTS}!A${rowNum}:G${rowNum}`;
				await updateRange(range, [
					[
						editingClientId,
						clientForm.name,
						clientForm.meterId,
						clientForm.contact,
						clientForm.meterNumber,
						clientForm.status,
						clientForm.notes,
					],
				]);
			} else {
				const id = generateId();
				await appendRows(SHEET_NAMES.ELECTRICITY_CLIENTS, [
					[
						id,
						clientForm.name,
						clientForm.meterId,
						clientForm.contact,
						clientForm.meterNumber,
						clientForm.status,
						clientForm.notes,
					],
				]);
			}
			resetClientForm();
			await loadAll();
		} catch (e) {
			showError("Failed to save: " + e.message);
		} finally {
			$loading = false;
		}
	}

	async function deleteClient(id) {
		if (!confirm("Delete this submeter? This cannot be undone.")) return;
		$loading = true;
		try {
			const gid = await getSheetGid(SHEET_NAMES.ELECTRICITY_CLIENTS);
			const rowNum = await findRowById(
				SHEET_NAMES.ELECTRICITY_CLIENTS,
				id,
			);
			if (rowNum === -1) throw new Error("Client not found");
			await deleteRow(gid, rowNum - 1);
			await loadAll();
		} catch (e) {
			showError("Failed to delete: " + e.message);
		} finally {
			$loading = false;
		}
	}
</script>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-800">Electricity</h1>
		<p class="text-sm text-gray-500">Manage meters, submeters, and bills</p>
	</div>
	<a
		href="{base}/electricity/bills"
		class="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
	>
		Bills
	</a>
</div>

<!-- ========== MAIN METERS ========== -->
<div class="mb-8">
	<div class="flex items-center justify-between mb-3">
		<h2 class="text-lg font-semibold text-gray-700">Main Meters</h2>
		<button
			onclick={() => {
				resetMeterForm();
				showMeterForm = true;
			}}
			class="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
		>
			+ Add Meter
		</button>
	</div>

	{#if showMeterForm}
		<div
			class="fixed inset-0 bg-black/40 z-40 flex items-start justify-center pt-20 px-4"
			role="presentation"
			onclick={() => resetMeterForm()}
		>
			<div
				class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6"
				role="presentation"
				onclick={(e) => e.stopPropagation()}
			>
				<h2 class="text-lg font-semibold mb-4">
					{editingMeterId ? "Edit" : "Add"} Main Meter
				</h2>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						saveMeter();
					}}
					class="space-y-3"
				>
					<div>
						<label
							for="m-name"
							class="block text-sm font-medium text-gray-700"
							>Name *</label
						>
						<input
							id="m-name"
							bind:value={meterForm.name}
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label
								for="m-number"
								class="block text-sm font-medium text-gray-700"
								>Meter Number</label
							>
							<input
								id="m-number"
								bind:value={meterForm.meterNumber}
								class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
							/>
						</div>
						<div>
							<label
								for="m-location"
								class="block text-sm font-medium text-gray-700"
								>Location</label
							>
							<input
								id="m-location"
								bind:value={meterForm.location}
								class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
							/>
						</div>
					</div>
					<div>
						<label
							for="m-status"
							class="block text-sm font-medium text-gray-700"
							>Status</label
						>
						<select
							id="m-status"
							bind:value={meterForm.status}
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
						>
							<option>Active</option>
							<option>Inactive</option>
						</select>
					</div>
					<div>
						<label
							for="m-notes"
							class="block text-sm font-medium text-gray-700"
							>Notes</label
						>
						<textarea
							id="m-notes"
							bind:value={meterForm.notes}
							rows="2"
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
						></textarea>
					</div>
					<div class="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onclick={resetMeterForm}
							class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
							>Cancel</button
						>
						<button
							type="submit"
							class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 cursor-pointer"
						>
							{editingMeterId ? "Update" : "Add"}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if $loading && meters.length === 0}
		<p class="text-gray-400 text-sm">Loading...</p>
	{:else if meters.length === 0}
		<p class="text-gray-400 text-sm">
			No main meters yet. Add one to get started.
		</p>
	{:else}
		<div class="space-y-2">
			{#each meters as meter}
				{@const clientCount = clients.filter(
					(c) => c.MeterID === meter.ID,
				).length}
				<div class="bg-white rounded-lg border border-gray-200 p-3">
					<div class="flex items-center justify-between">
						<div>
							<div class="flex items-center gap-2">
								<h3 class="font-semibold text-gray-800 text-sm">
									{meter.Name}
								</h3>
								<span
									class="text-xs px-2 py-0.5 rounded-full {meter.Status ===
									'Active'
										? 'bg-green-100 text-green-700'
										: 'bg-gray-100 text-gray-500'}"
								>
									{meter.Status}
								</span>
								<span class="text-xs text-gray-400"
									>{clientCount} submeter{clientCount !== 1
										? "s"
										: ""}</span
								>
							</div>
							{#if meter.MeterNumber || meter.Location}
								<p class="text-xs text-gray-500 mt-0.5">
									{meter.MeterNumber
										? `#${meter.MeterNumber}`
										: ""}{meter.MeterNumber &&
									meter.Location
										? " · "
										: ""}{meter.Location || ""}
								</p>
							{/if}
						</div>
						<div class="flex items-center gap-1 ml-2 shrink-0">
							<button
								onclick={() => editMeter(meter)}
								class="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-700 cursor-pointer"
								>Edit</button
							>
							<button
								onclick={() => deleteMeter(meter.ID)}
								class="text-xs px-2 py-1.5 text-red-400 hover:text-red-600 cursor-pointer"
								>Delete</button
							>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- ========== SUBMETERS (CLIENTS) ========== -->
<div>
	<div class="flex items-center justify-between mb-3">
		<h2 class="text-lg font-semibold text-gray-700">Submeters</h2>
		<button
			onclick={() => {
				resetClientForm();
				showClientForm = true;
			}}
			disabled={meters.length === 0}
			class="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
		>
			+ Add Submeter
		</button>
	</div>

	{#if showClientForm}
		<div
			class="fixed inset-0 bg-black/40 z-40 flex items-start justify-center pt-20 px-4"
			role="presentation"
			onclick={() => resetClientForm()}
		>
			<div
				class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6"
				role="presentation"
				onclick={(e) => e.stopPropagation()}
			>
				<h2 class="text-lg font-semibold mb-4">
					{editingClientId ? "Edit" : "Add"} Submeter
				</h2>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						saveClient();
					}}
					class="space-y-3"
				>
					<div>
						<label
							for="c-name"
							class="block text-sm font-medium text-gray-700"
							>Name *</label
						>
						<input
							id="c-name"
							bind:value={clientForm.name}
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
						/>
					</div>
					<div>
						<label
							for="c-meter"
							class="block text-sm font-medium text-gray-700"
							>Main Meter *</label
						>
						<select
							id="c-meter"
							bind:value={clientForm.meterId}
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
						>
							{#each meters.filter((m) => m.Status === "Active") as meter}
								<option value={meter.ID}
									>{meter.Name}{meter.MeterNumber
										? ` (#${meter.MeterNumber})`
										: ""}</option
								>
							{/each}
						</select>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label
								for="c-contact"
								class="block text-sm font-medium text-gray-700"
								>Contact</label
							>
							<input
								id="c-contact"
								bind:value={clientForm.contact}
								class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
							/>
						</div>
						<div>
							<label
								for="c-submeter"
								class="block text-sm font-medium text-gray-700"
								>Submeter Number</label
							>
							<input
								id="c-submeter"
								bind:value={clientForm.meterNumber}
								class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
							/>
						</div>
					</div>
					<div>
						<label
							for="c-status"
							class="block text-sm font-medium text-gray-700"
							>Status</label
						>
						<select
							id="c-status"
							bind:value={clientForm.status}
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
						>
							<option>Active</option>
							<option>Inactive</option>
						</select>
					</div>
					<div>
						<label
							for="c-notes"
							class="block text-sm font-medium text-gray-700"
							>Notes</label
						>
						<textarea
							id="c-notes"
							bind:value={clientForm.notes}
							rows="2"
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
						></textarea>
					</div>
					<div class="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onclick={resetClientForm}
							class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
							>Cancel</button
						>
						<button
							type="submit"
							class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 cursor-pointer"
						>
							{editingClientId ? "Update" : "Add"}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if meters.length === 0}
		<p class="text-gray-400 text-sm">
			Add a main meter first, then add submeters.
		</p>
	{:else if $loading && clients.length === 0}
		<p class="text-gray-400 text-sm">Loading...</p>
	{:else if clients.length === 0}
		<p class="text-gray-400 text-sm">
			No submeters yet. Add one to get started.
		</p>
	{:else}
		<div class="space-y-2">
			{#each clients as client}
				<div class="bg-white rounded-lg border border-gray-200 p-3">
					<div class="flex items-start justify-between">
						<div>
							<div class="flex items-center gap-2">
								<h3 class="font-semibold text-gray-800 text-sm">
									{client.Name}
								</h3>
								<span
									class="text-xs px-2 py-0.5 rounded-full {client.Status ===
									'Active'
										? 'bg-green-100 text-green-700'
										: 'bg-gray-100 text-gray-500'}"
								>
									{client.Status}
								</span>
							</div>
							<p class="text-xs text-gray-500 mt-0.5">
								Main: {meterName(client.MeterID)}
								{#if client.MeterNumber}
									· Submeter #{client.MeterNumber}{/if}
								{#if client.Contact}
									· {client.Contact}{/if}
							</p>
						</div>
						<div class="flex items-center gap-1 ml-2 shrink-0">
							<button
								onclick={() => editClient(client)}
								class="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-700 cursor-pointer"
								>Edit</button
							>
							<button
								onclick={() => deleteClient(client.ID)}
								class="text-xs px-2 py-1.5 text-red-400 hover:text-red-600 cursor-pointer"
								>Delete</button
							>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
