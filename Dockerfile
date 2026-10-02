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

# CVE-2026-14456: OpenSSL DoS via unbounded memory growth in the QUIC server.
# Alpine 3.24 ships the fix in 3.5.8-r0, but the pinned node:22-alpine still
# carries 3.5.7-r0 and upstream has not rebuilt, so bumping the base digest
# does not help. Take the patched packages straight from the Alpine repo.
RUN apk upgrade --no-cache libssl3 libcrypto3

# The node base image bundles an npm whose vendored dependencies (tar,
# sigstore, picomatch, brace-expansion, undici) carry fixable HIGH/CRITICAL
# CVEs flagged by the Trivy publish gate. Upgrade npm to a release that ships
# fixed versions, then patch the ones no npm release bundles yet: at
# npm@12.1.0 the newest available, brace-expansion is still 5.0.9 and undici
# still 6.28.0, so bumping npm alone cannot clear the gate.
#   brace-expansion 5.0.11 - CVE-2026-102276, CVE-2026-102278
#   ip-address     10.3.1  - CVE-2026-69192
#   undici          6.28.1 - CVE-2026-19534
RUN npm install -g npm@11.18.0 \
	&& cd /tmp \
	&& npm pack brace-expansion@5.0.11 \
	&& mkdir -p /tmp/brace-expansion-patch \
	&& tar -xzf brace-expansion-5.0.11.tgz -C /tmp/brace-expansion-patch \
	&& rm -rf /usr/local/lib/node_modules/npm/node_modules/brace-expansion \
	&& mv /tmp/brace-expansion-patch/package /usr/local/lib/node_modules/npm/node_modules/brace-expansion \
	&& rm -rf /tmp/brace-expansion-patch /tmp/brace-expansion-5.0.11.tgz \
	&& npm pack ip-address@10.3.1 \
	&& mkdir -p /tmp/ip-address-patch \
	&& tar -xzf ip-address-10.3.1.tgz -C /tmp/ip-address-patch \
	&& rm -rf /usr/local/lib/node_modules/npm/node_modules/ip-address \
	&& mv /tmp/ip-address-patch/package /usr/local/lib/node_modules/npm/node_modules/ip-address \
	&& rm -rf /tmp/ip-address-patch /tmp/ip-address-10.3.1.tgz \
	# CVE-2026-73566: node-tar DoS via a crafted long path. npm@11.18.0 still
	# bundles tar 7.5.19; patch it up to the fixed 7.5.21 the same way.
	&& npm pack tar@7.5.21 \
	&& mkdir -p /tmp/tar-patch \
	&& tar -xzf tar-7.5.21.tgz -C /tmp/tar-patch \
	&& rm -rf /usr/local/lib/node_modules/npm/node_modules/tar \
	&& mv /tmp/tar-patch/package /usr/local/lib/node_modules/npm/node_modules/tar \
	&& rm -rf /tmp/tar-patch /tmp/tar-7.5.21.tgz \
	# CVE-2026-19534: undici DoS via an unrequested WebSocket subprotocol.
	# npm vendors 6.28.0 up to and including npm@12.1.0; 6.28.1 is the fix.
	&& npm pack undici@6.28.1 \
	&& mkdir -p /tmp/undici-patch \
	&& tar -xzf undici-6.28.1.tgz -C /tmp/undici-patch \
	&& rm -rf /usr/local/lib/node_modules/npm/node_modules/undici \
	&& mv /tmp/undici-patch/package /usr/local/lib/node_modules/npm/node_modules/undici \
	&& rm -rf /tmp/undici-patch /tmp/undici-6.28.1.tgz \
	&& npm cache clean --force

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
