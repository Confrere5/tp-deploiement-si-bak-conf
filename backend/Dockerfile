FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional

COPY src ./src

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]