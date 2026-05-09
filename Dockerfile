# syntax=docker/dockerfile:1.6
#
# Production image for Flood. The bundled-rtorrent variant was removed:
# run rtorrent in its own container and connect Flood to it over SCGI.

ARG NODE_IMAGE=docker.io/node:24-alpine

# ---------- build ----------
FROM ${NODE_IMAGE} AS build

WORKDIR /usr/src/app

# Use the pnpm version pinned by `packageManager` in package.json.
RUN corepack enable

COPY . ./

RUN pnpm install --frozen-lockfile \
 && pnpm run build

# ---------- runtime ----------
FROM ${NODE_IMAGE} AS runtime

WORKDIR /usr/src/app

# mediainfo: optional dependency used by Flood for media file inspection.
# The `node` user (uid/gid 1000) already exists in the base image, which is
# convenient: it matches the PUID/PGID 1000 the rtorrent container expects,
# so files written by either side share ownership on the host.
RUN apk --no-cache add mediainfo

# esbuild bundles the server into dist/index.js with `geoip-country` left
# external, so node_modules is still required at runtime.
COPY --from=build --chown=node:node /usr/src/app /usr/src/app

# Pre-create rundir so a named volume mounted here inherits node ownership
# instead of getting created root-owned on first run.
RUN install -d -o node -g node /var/lib/flood

USER node

EXPOSE 3000

ENTRYPOINT ["node", "--enable-source-maps", "--use_strict", "dist/index.js", "--host=::"]
