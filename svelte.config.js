import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html' // SPA fallback for client-side routing
		}),
		prerender: {
			handleUnseenRoutes: 'ignore' // Dynamic routes like [id] are handled client-side
		},
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/Rentals' : ''
		}
	}
};

export default config;
