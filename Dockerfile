ARG  NODE_VERSION
FROM node:${NODE_VERSION}-alpine AS base
RUN mkdir -p /usr/src/app/node_modules && chown -R node:node /usr/src/app
WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./

FROM base AS dependencies
USER node
RUN yarn install --frozen-lockfile --production --non-interactive --no-progress --prefer-offline
RUN npx prisma generate

FROM base AS release
COPY --from=dependencies --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --chown=node:node src ./src
COPY --chown=node:node prisma ./prisma
RUN npx prisma generate

ENV PORT=1337

EXPOSE $PORT

CMD [ "yarn", "start" ]
