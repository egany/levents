FROM node:18.16.0

ENV NODE_ENV production

WORKDIR /levents

ADD . .

RUN npm install

CMD ["npm", "start"]