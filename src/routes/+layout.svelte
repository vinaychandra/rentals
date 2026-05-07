<script>
	import "../app.css";
	import { base } from "$app/paths";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { initAuth, signIn, signOut, tryRestoreSession } from "$lib/auth.js";
	import { ensureSheetSetup, findOrCreateSpreadsheet } from "$lib/sheets.js";
	import { authenticated, errorMessage } from "$lib/stores.js";
	import { GOOGLE_CLIENT_ID } from "$lib/config.js";

	let { children } = $props();
	let mobileMenuOpen = $state(false);
	let ready = $state(false);
	let signingIn = $state(false);

	const navLinks = [
		{ href: `${base}/`, label: "Home" },
		{ href: `${base}/rentals`, label: "Rentals" },
		{ href: `${base}/electricity`, label: "Electricity" },
	];

	function isActive(linkHref) {
		const current = $page.url.pathname;
		if (linkHref === `${base}/`)
			return current === `${base}/` || current === base;
		return current.startsWith(linkHref);
	}

	onMount(() => {
		// Register service worker for PWA
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
		}

		// Wait for GIS script to load
		const interval = setInterval(async () => {
			if (typeof google !== "undefined" && google.accounts) {
				clearInterval(interval);
				initAuth();
				ready = true;

				// Try to restore a previous session
				const restored = await tryRestoreSession();
				if (restored) {
					try {
						await findOrCreateSpreadsheet();
						await ensureSheetSetup();
						$authenticated = true;
					} catch {
						// Token may lack new scopes — clear it and require fresh sign-in
						signOut();
					}
				}
			}
		}, 100);

		return () => clearInterval(interval);
	});

	async function handleSignIn() {
		signingIn = true;
		try {
			await signIn();
			await findOrCreateSpreadsheet();
			await ensureSheetSetup();
			$authenticated = true;
		} catch (e) {
			console.error("Sign in failed:", e);
		} finally {
			signingIn = false;
		}
	}

	function handleSignOut() {
		signOut();
		$authenticated = false;
	}
</script>

{#if $errorMessage}
	<div
		class="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 text-center text-sm"
	>
		{$errorMessage}
	</div>
{/if}

{#if !$authenticated}
	<!-- Login Screen -->
	<div class="min-h-screen flex items-center justify-center bg-gray-50">
		<div class="text-center p-8">
			<h1 class="text-3xl font-bold text-gray-800 mb-2">Rentals</h1>
			<p class="text-gray-500 mb-8">Rental & Payment Tracking</p>
			{#if !GOOGLE_CLIENT_ID}
				<p class="text-red-500 text-sm mb-4">
					Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID
					in your .env file.
				</p>
			{:else if !ready}
				<p class="text-gray-400 text-sm">Loading Google sign-in...</p>
			{:else}
				<button
					onclick={handleSignIn}
					disabled={signingIn}
					class="bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium shadow-sm hover:shadow-md hover:bg-gray-50 transition-all disabled:opacity-50 cursor-pointer"
				>
					{signingIn ? "Signing in..." : "Sign in with Google"}
				</button>
			{/if}
		</div>
	</div>
{:else}
	<!-- App Shell -->
	<div class="min-h-screen bg-gray-50">
		<!-- Top Nav -->
		<nav class="bg-white shadow-sm border-b border-gray-200">
			<div class="max-w-5xl mx-auto px-4">
				<div class="flex items-center justify-between h-14">
					<!-- Logo -->
					<a href="{base}/" class="text-lg font-bold text-gray-800"
						>Rentals</a
					>

					<!-- Desktop Nav -->
					<div class="hidden md:flex items-center gap-1">
						{#each navLinks as link}
							<a
								href={link.href}
								class="px-3 py-2 rounded-md text-sm font-medium transition-colors {isActive(
									link.href,
								)
									? 'bg-gray-100 text-gray-900'
									: 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}"
							>
								{link.label}
							</a>
						{/each}
						<button
							onclick={handleSignOut}
							class="ml-4 text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
						>
							Sign out
						</button>
					</div>

					<!-- Mobile Menu Button -->
					<button
						onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
						class="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
					>
						<svg
							class="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							{#if mobileMenuOpen}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							{:else}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 6h16M4 12h16M4 18h16"
								/>
							{/if}
						</svg>
					</button>
				</div>
			</div>

			<!-- Mobile Nav -->
			{#if mobileMenuOpen}
				<div class="md:hidden border-t border-gray-200 px-4 py-2">
					{#each navLinks as link}
						<a
							href={link.href}
							onclick={() => (mobileMenuOpen = false)}
							class="block px-3 py-2 rounded-md text-sm font-medium {isActive(
								link.href,
							)
								? 'bg-gray-100 text-gray-900'
								: 'text-gray-500 hover:text-gray-900'}"
						>
							{link.label}
						</a>
					{/each}
					<button
						onclick={handleSignOut}
						class="block w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
					>
						Sign out
					</button>
				</div>
			{/if}
		</nav>

		<!-- Page Content -->
		<main class="max-w-5xl mx-auto px-4 py-6">
			{@render children()}
		</main>
	</div>
{/if}
