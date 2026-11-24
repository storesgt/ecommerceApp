FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json prisma ./
COPY server ./server
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --include=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY index.html admin.html app.js admin.js styles.css admin.css runtime-config.js brand-theme.js ./
COPY uploads ./uploads
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server/src/main.js"]
