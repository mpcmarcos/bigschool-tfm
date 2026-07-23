FROM node:24-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:5000
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY src/resources-app/package*.json ./
RUN npm ci

COPY src/resources-app/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY src/resources-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist ./

EXPOSE 8080
