FROM mcr.microsoft.com/playwright:v1.52.0-noble-arm64

# ENV http_proxy=http://192.168.0.106:7897
# ENV https_proxy=http://192.168.0.106:7897
# ENV no_proxy=localhost,127.0.0.1

# 2.1 Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# 2.4 Copy the rest of the application code without node_modules
COPY . .
RUN pnpm install
# RUN pnpx playwright install --with-deps chromium

# 2.3 Build the application
RUN pnpm run build

# 2.4 Run the application
CMD ["node", "dist/app.js"]
