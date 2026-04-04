# Stage 1 — Build all three Angular apps
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies once (cache layer)
COPY innait-wiam-ui/package.json ./
RUN npm install --ignore-scripts

# Copy source
COPY innait-wiam-ui/ .

# Build all three apps
RUN npx ng build login-portal        --configuration=production
RUN npx ng build self-service-portal --configuration=production
RUN npx ng build admin-console       --configuration=production

# Stage 2 — Serve with nginx
FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html

# Angular 18 builder outputs to dist/{app}/browser/
COPY --from=builder /app/dist/login-portal/browser        /usr/share/nginx/html/login-portal
COPY --from=builder /app/dist/self-service-portal/browser /usr/share/nginx/html/self-service-portal
COPY --from=builder /app/dist/admin-console/browser       /usr/share/nginx/html/admin-console

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 4200 4300 4400
CMD ["nginx", "-g", "daemon off;"]
