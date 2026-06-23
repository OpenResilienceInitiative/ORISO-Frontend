ARG NODE_VERSION=18.16.1
ARG PORT=80

FROM node:${NODE_VERSION} AS frontendBuild

WORKDIR /app

COPY package.json package-lock.json ./
COPY src/extensions ./src/extensions

RUN npm ci --ignore-scripts --legacy-peer-deps

COPY . .

ENV CI=false
ENV NODE_ENV=development

RUN npm run build

FROM node:${NODE_VERSION} AS proxyBuild

WORKDIR /app

COPY proxy/package.json proxy/package-lock.json ./

RUN npm ci --ignore-scripts

COPY proxy ./

FROM node:${NODE_VERSION}

ARG PORT=80

USER node
WORKDIR /app
EXPOSE ${PORT}

COPY --from=proxyBuild --chown=node:node /app ./
COPY --from=frontendBuild --chown=node:node /app/build ./build
COPY --chown=node:node scripts/docker-entrypoint.sh ./docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=${PORT}

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
