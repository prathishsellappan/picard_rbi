
FROM node:22-alpine

WORKDIR /app

# Copy root dependency manifests
COPY package*.json ./

# Copy workspace manifests
COPY web/package*.json ./web/
COPY contracts/package*.json ./contracts/

# Install project and workspace dependencies
RUN npm install

# Copy the remaining application code
COPY . .
ENV NEXT_PUBLIC_CHAIN_ID=31337
RUN npm run build -w web
EXPOSE 3000
EXPOSE 8545
# CMD ["npm", "run", "local"]
CMD ["node", "scripts/start-local.mjs", "--lan", "--prod"]