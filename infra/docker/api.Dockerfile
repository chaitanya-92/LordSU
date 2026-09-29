FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package.json ./
RUN npm install --omit=dev
COPY apps/api/src ./src
RUN mkdir -p /storage /uploads && chown -R node:node /storage /uploads
EXPOSE 4000
USER node
CMD ["node","src/server.js"]
