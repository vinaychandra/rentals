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
    import {
        SHEET_NAMES,
        PAYMENT_METHODS,
        generateId,
        formatINR,
    } from "$lib/config.js";
    import { loading, showError } from "$lib/stores.js";

    let properties = $state([]);
    let allPayments = $state([]);
    let showForm = $state(false);
    let editingId = $state(null);
    let form = $state({
        name: "",
        address: "",
        monthlyRent: "",
        tenantName: "",
        tenantContact: "",
        status: "Active",
        notes: "",
    });

    const HEADERS = [
        "ID",
        "Name",
        "Address",
        "MonthlyRent",
        "TenantName",
        "TenantContact",
        "Status",
        "Notes",
    ];

    // Current billing month (previous month convention)
    const curMonth = new Date().getMonth() || 12;
    const curMonthYear = curMonth === 12 ? new Date().getFullYear() - 1 : new Date().getFullYear();
    const curMonthKey = `${curMonthYear}-${String(curMonth).padStart(2, "0")}`;
    const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const curMonthLabel = `${MONTH_NAMES[curMonth]} ${curMonthYear}`;

    onMount(() => loadProperties());

    async function loadProperties() {
        $loading = true;
        try {
            const [propData, payData] = await Promise.all([
                readSheetAsObjects(SHEET_NAMES.PROPERTIES),
                readSheetAsObjects(SHEET_NAMES.RENTAL_PAYMENTS),
            ]);
            properties = propData.rows;
            allPayments = payData.rows;
        } catch (e) {
            showError("Failed to load properties: " + e.message);
        } finally {
            $loading = false;
        }
    }

    /** Total paid for a property in the current billing month */
    function paidThisMonth(propId) {
        return allPayments
            .filter((p) => p.PropertyID === propId && p.Month === curMonthKey)
            .reduce((s, p) => s + Number(p.Amount || 0), 0);
    }

    /** Most recent payment for a property */
    function lastPayment(propId) {
        const propPayments = allPayments
            .filter((p) => p.PropertyID === propId)
            .sort((a, b) => b.Date.localeCompare(a.Date));
        return propPayments[0] || null;
    }

    function resetForm() {
        form = {
            name: "",
            address: "",
            monthlyRent: "",
            tenantName: "",
            tenantContact: "",
            status: "Active",
            notes: "",
        };
        editingId = null;
        showForm = false;
    }

    function editProperty(prop) {
        form = {
            name: prop.Name || "",
            address: prop.Address || "",
            monthlyRent: prop.MonthlyRent || "",
            tenantName: prop.TenantName || "",
            tenantContact: prop.TenantContact || "",
            status: prop.Status || "Active",
            notes: prop.Notes || "",
        };
        editingId = prop.ID;
        showForm = true;
    }

    async function saveProperty() {
        if (!form.name || !form.monthlyRent) {
            showError("Name and Monthly Rent are required");
            return;
        }

        $loading = true;
        try {
            if (editingId) {
                const rowNum = await findRowById(
                    SHEET_NAMES.PROPERTIES,
                    editingId,
                );
                if (rowNum === -1) throw new Error("Property not found");
                const range = `${SHEET_NAMES.PROPERTIES}!A${rowNum}:H${rowNum}`;
                await updateRange(range, [
                    [
                        editingId,
                        form.name,
                        form.address,
                        form.monthlyRent,
                        form.tenantName,
                        form.tenantContact,
                        form.status,
                        form.notes,
                    ],
                ]);
            } else {
                const id = generateId();
                await appendRows(SHEET_NAMES.PROPERTIES, [
                    [
                        id,
                        form.name,
                        form.address,
                        form.monthlyRent,
                        form.tenantName,
                        form.tenantContact,
                        form.status,
                        form.notes,
                    ],
                ]);
            }
            resetForm();
            await loadProperties();
        } catch (e) {
            showError("Failed to save: " + e.message);
        } finally {
            $loading = false;
        }
    }

    async function deleteProperty(id) {
        if (!confirm("Delete this property? This cannot be undone.")) return;

        $loading = true;
        try {
            const gid = await getSheetGid(SHEET_NAMES.PROPERTIES);
            const rowNum = await findRowById(SHEET_NAMES.PROPERTIES, id);
            if (rowNum === -1) throw new Error("Property not found");
            await deleteRow(gid, rowNum - 1); // deleteRow uses 0-based index
            await loadProperties();
        } catch (e) {
            showError("Failed to delete: " + e.message);
        } finally {
            $loading = false;
        }
    }
</script>

<div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-800">Properties</h1>
    <button
        onclick={() => {
            resetForm();
            showForm = true;
        }}
        class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
    >
        + Add Property
    </button>
</div>

<!-- Form Modal -->
{#if showForm}
    <div
        class="fixed inset-0 bg-black/40 z-40 flex items-start justify-center pt-20 px-4"
        role="presentation"
        onclick={() => resetForm()}
    >
        <div
            class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6"
            role="presentation"
            onclick={(e) => e.stopPropagation()}
        >
            <h2 class="text-lg font-semibold mb-4">
                {editingId ? "Edit" : "Add"} Property
            </h2>
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    saveProperty();
                }}
                class="space-y-3"
            >
                <div>
                    <label
                        for="name"
                        class="block text-sm font-medium text-gray-700"
                        >Name *</label
                    >
                    <input
                        id="name"
                        bind:value={form.name}
                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    />
                </div>
                <div>
                    <label
                        for="address"
                        class="block text-sm font-medium text-gray-700"
                        >Address</label
                    >
                    <input
                        id="address"
                        bind:value={form.address}
                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    />
                </div>
                <div>
                    <label
                        for="rent"
                        class="block text-sm font-medium text-gray-700"
                        >Monthly Rent (₹) *</label
                    >
                    <input
                        id="rent"
                        type="number"
                        bind:value={form.monthlyRent}
                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label
                            for="tenant"
                            class="block text-sm font-medium text-gray-700"
                            >Tenant Name</label
                        >
                        <input
                            id="tenant"
                            bind:value={form.tenantName}
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            for="contact"
                            class="block text-sm font-medium text-gray-700"
                            >Contact</label
                        >
                        <input
                            id="contact"
                            bind:value={form.tenantContact}
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                        />
                    </div>
                </div>
                <div>
                    <label
                        for="status"
                        class="block text-sm font-medium text-gray-700"
                        >Status</label
                    >
                    <select
                        id="status"
                        bind:value={form.status}
                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    >
                        <option>Active</option>
                        <option>Vacant</option>
                        <option>Inactive</option>
                    </select>
                </div>
                <div>
                    <label
                        for="notes"
                        class="block text-sm font-medium text-gray-700"
                        >Notes</label
                    >
                    <textarea
                        id="notes"
                        bind:value={form.notes}
                        rows="2"
                        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    ></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onclick={resetForm}
                        class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
                        >Cancel</button
                    >
                    <button
                        type="submit"
                        class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 cursor-pointer"
                    >
                        {editingId ? "Update" : "Add"}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Properties List -->
{#if $loading && properties.length === 0}
    <p class="text-gray-400 text-sm">Loading...</p>
{:else if properties.length === 0}
    <p class="text-gray-400 text-sm">
        No properties yet. Add one to get started.
    </p>
{:else}
    <div class="space-y-3">
        {#each properties as prop}
            {@const rent = Number(prop.MonthlyRent || 0)}
            {@const paid = paidThisMonth(prop.ID)}
            {@const last = lastPayment(prop.ID)}
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="flex items-start justify-between">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-semibold text-gray-800">
                                {prop.Name}
                            </h3>
                            <span
                                class="text-xs px-2 py-0.5 rounded-full {prop.Status ===
                                'Active'
                                    ? 'bg-green-100 text-green-700'
                                    : prop.Status === 'Vacant'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-500'}"
                            >
                                {prop.Status}
                            </span>
                        </div>
                        {#if prop.Address}
                            <p class="text-sm text-gray-500 mt-1">
                                {prop.Address}
                            </p>
                        {/if}
                        <p class="text-sm font-medium text-gray-700 mt-1">
                            {formatINR(rent)}/month
                        </p>
                        {#if prop.TenantName}
                            <p class="text-sm text-gray-500 mt-1">
                                Tenant: {prop.TenantName}
                                {prop.TenantContact
                                    ? `(${prop.TenantContact})`
                                    : ""}
                            </p>
                        {/if}

                        <!-- Payment summary -->
                        <div class="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span class="{paid >= rent ? 'text-green-600' : paid > 0 ? 'text-orange-500' : 'text-red-500'} font-medium">
                                {curMonthLabel}: {formatINR(paid)} / {formatINR(rent)}
                                {#if paid >= rent}✓{:else if rent - paid > 0}(due {formatINR(rent - paid)}){/if}
                            </span>
                            {#if last}
                                <span class="text-gray-400">
                                    Last: {formatINR(Number(last.Amount))} on {last.Date} via {last.Method}
                                </span>
                            {:else}
                                <span class="text-gray-400">No payments yet</span>
                            {/if}
                        </div>
                    </div>
                    <div class="flex items-center gap-1 ml-2 shrink-0">
                        <a
                            href="{base}/rentals/{prop.ID}"
                            class="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            Payments
                        </a>
                        <button
                            onclick={() => editProperty(prop)}
                            class="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                            >Edit</button
                        >
                        <button
                            onclick={() => deleteProperty(prop.ID)}
                            class="text-xs px-2 py-1.5 text-red-400 hover:text-red-600 cursor-pointer"
                            >Delete</button
                        >
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}
