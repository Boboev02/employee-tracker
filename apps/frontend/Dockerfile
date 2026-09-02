FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY .next ./.next
COPY public ./public
COPY next.config.ts ./
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
