FROM node:alpine as builder

WORKDIR /temp

COPY package*.json .
RUN npm install

COPY . .
RUN npm run build

FROM node:alpine

WORKDIR opt/
RUN mkdir peerOrganizations

COPY --from=builder /temp/dist/ ./dist/
COPY --from=builder /temp/node_modules/ ./node_modules/
COPY .env .

CMD ["dist/app.js"]