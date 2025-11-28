# ------------------------------------
# BOSQICH 1: BUILDER
# ------------------------------------
FROM node:24.11.1-alpine AS builder

# Ish papkasini o'rnatamiz
WORKDIR /app

# Package.json va package-lock.json fayllarini nusxalaymiz
COPY package*.json ./

# Bog'liqliklarni o'rnatamiz
RUN npm install

# Butun loyiha kodini nusxalaymiz
# Bu .env.production faylini ham olib keladi
COPY . .

# .env.production faylini qurishda ishlatish uchun
# Agar siz VITE_... o'zgaruvchilari Vue 3 (Vite) da ishlatayotgan bo'lsangiz
# va ular qurish vaqtida ishlashi kerak bo'lsa, bu to'g'ri.
# Ishlab chiqarish uchun optimallashtirilgan buildni amalga oshiramiz
RUN npm run build


# ------------------------------------
# BOSQICH 2: RUNTIME
# ------------------------------------
FROM nginx:stable-alpine AS final

# 1. Nginx konfiguratsiyasi
# Vue Router'ning history mode'i ishlashi uchun kerak (index.html'ga yo'naltirish)
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf

# 2. Statik fayllarni nusxalash
# Qurish bosqichidan faqat statik fayllarni olamiz
COPY --from=builder /app/dist /usr/share/nginx/html

# 3. Portni ochamiz
EXPOSE 80

# Konteyner ishga tushganda Nginx'ni ishlatamiz (standart command)
CMD ["nginx", "-g", "daemon off;"]
