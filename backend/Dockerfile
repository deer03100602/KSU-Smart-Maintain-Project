FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/university_maintenance?schema=public"
RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "start"]
