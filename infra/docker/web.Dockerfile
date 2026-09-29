FROM node:26-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/web/package.json ./
RUN npm install
COPY apps/web ./
RUN npm run build

FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
EXPOSE 3000
USER node
CMD ["npm","run","start"]
