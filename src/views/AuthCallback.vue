<template>
  <div class="callback-container">
    <p>Authenticating...</p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  const token = route.query.token;
  if (token) {
    authStore.setToken(token);
    router.push('/');
  } else {
    router.push('/login');
  }
});
</script>

<style scoped>
.callback-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #1e1e1e;
  color: #fff;
}
</style>
