FROM node:22.12.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node . .
ENV NODE_ENV=production DATABASE_BACKEND=supabase PORT=3000
USER node
EXPOSE 3000
CMD ["npm", "start"]
