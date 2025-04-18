FROM node:18-alpine

RUN apk add --no-cache python3 py3-pip ffmpeg bash

WORKDIR /app

ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
ENV PATH="/app/node_modules/.bin:$PATH"

COPY package.json ./
RUN npm install

COPY . .
COPY cookies.txt /app/cookies.txt

RUN mkdir -p /app/downloads

EXPOSE 3000
CMD ["npm", "run", "start"]
