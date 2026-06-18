FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/main.api.js"]
