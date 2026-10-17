FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src ./src
COPY public ./public
COPY index.html ./
COPY vite.config.js ./
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
