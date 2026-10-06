FROM node:22-alpine
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY package.json ./
COPY src ./src
EXPOSE 8787
USER node
CMD ["node", "--experimental-strip-types", "src/server.ts"]
