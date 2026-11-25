# The Dashboard image, ghcr.io/sweg9/live-demo: the built app served by nginx. In k3s the ingress
# sends / here and /api to the server (backend-server deploy/k8s/server/ingress.yaml), so the app
# and the API share one origin and the session cookie stays SameSite=Strict.
#
# Only static files: no secrets, no mock, no textured scan (C-05, C-10). nginx runs as a non-root
# user on port 8080.

FROM node:24-alpine AS build
WORKDIR /app
# postinstall makes src/api/schema.d.ts from api/ and puts the mock's worker in public/
COPY package.json package-lock.json ./
COPY api ./api
COPY public ./public
# npm install, not npm ci: npm 11 rejects its own lockfile for the optional wasm builds of rolldown
# and sharp (nested @emnapi). With package-lock.json present, it still installs the locked versions.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
