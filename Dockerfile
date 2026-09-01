# Build em dois estágios: o primeiro precisa das devDependencies (typescript,
# tsc-alias) para compilar; a imagem final leva só o dist e as dependências
# de produção.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# O PWA exportado. Vai como está: já é build, não precisa compilar de novo.
COPY web ./web

# A porta real vem da variável PORT injetada pelo host; 3000 é só o padrão
# do env.ts, e este EXPOSE é documentação.
EXPOSE 3000
CMD ["node", "dist/server.js"]
