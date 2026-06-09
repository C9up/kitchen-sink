<script setup lang="ts">
defineProps<{ user: { name: string }; count: number }>()
</script>

<template>
  <main class="mx-auto max-w-xl p-8">
    <h1 class="text-2xl font-bold">Hello, {{ user.name }}</h1>
    <p class="mt-2 text-gray-600">Server-rendered count: {{ count }}</p>
  </main>
</template>
