FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package.json ./
RUN npm install --omit=dev
COPY apps/api/src ./src
EXPOSE 4000
USER node
CMD ["node","src/server.js"]
