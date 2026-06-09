<script lang="ts">
  let { user, count }: { user: { name: string }; count: number } = $props()
</script>

<main class="mx-auto max-w-xl p-8">
  <h1 class="text-2xl font-bold">Hello, {user.name}</h1>
  <p class="mt-2 text-gray-600">Server-rendered count: {count}</p>
</main>
