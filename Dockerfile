ARG NODE_VERSION=22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2
ARG PORT=80

FROM node:$NODE_VERSION AS proxybuild

ARG PORT

USER node
WORKDIR /app
COPY proxy /app

ENV NODE_ENV=development
ENV PORT=$PORT

# Currently nothing to build inside
# RUN npm run install
# RUN npm run build
# RUN rm /app/node_modules

###
# Build is done on github so no need for docker build
#FROM node:$NODE_VERSION as frontendBuild
#
#USER node
#WORKDIR /app
#COPY . /app
#
#ENV NODE_ENV=development
#ENV PORT=$PORT
#
#RUN npm install --ignore-scripts
#RUN npm run build

# Prod build
FROM node:$NODE_VERSION

ARG PORT=80

USER node
WORKDIR /app
EXPOSE $PORT
COPY --from=proxybuild /app ./
COPY --chown=node:node build /app/build
COPY --chown=node:node scripts/docker-entrypoint.sh /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=$PORT

RUN npm ci --ignore-scripts

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
