# Stage 1: build the Vite app
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Pass VITE_ env vars at build time: docker build --build-arg VITE_FOO=bar .
ARG VITE_EXAMPLE_KEY
ENV VITE_EXAMPLE_KEY=$VITE_EXAMPLE_KEY
RUN npm run build

# Stage 2: serve static output with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
