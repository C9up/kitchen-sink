interface HomeProps {
	user: { name: string };
	count: number;
}

/**
 * A React page rendered by Photon. Server-rendered with `props`, then
 * hydrated on the client (the button becomes interactive after hydration).
 */
export default function Home({ user, count }: HomeProps) {
	return (
		<main className="mx-auto max-w-xl p-8">
			<h1 className="text-2xl font-bold">Hello, {user.name}</h1>
			<p className="mt-2 text-gray-600">Server-rendered count: {count}</p>
			<button
				type="button"
				className="mt-4 rounded bg-blue-600 px-4 py-2 text-white"
				onClick={() => alert(`Clicked! count was ${count}`)}
			>
				Click me (works only after hydration)
			</button>
		</main>
	);
}
