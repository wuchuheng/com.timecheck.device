# FROM debian:stable-backports

# # 1. Set up the dependencies
# RUN apt-get update

# RUN apt-get install -y \
#     ca-certificates \
#     fonts-liberation \
#     libasound2 \
#     libatk-bridge2.0-0 \
#     libatk1.0-0 \
#     libc6 \
#     libcairo2 \
#     libcups2 \
#     libdbus-1-3 \
#     libexpat1 \
#     libfontconfig1 \
#     libgbm1 \
#     libgcc1 \
#     libglib2.0-0 \
#     libgtk-3-0 \
#     libnspr4 \
#     libnss3 \
#     libpango-1.0-0 \
#     libpangocairo-1.0-0 \
#     libstdc++6 \
#     libx11-6 \
#     libx11-xcb1 \
#     libxcb1 \
#     libxcomposite1 \
#     libxcursor1 \
#     libxdamage1 \
#     libxext6 \
#     libxfixes3 \
#     libxi6 \
#     libxrandr2 \
#     libxrender1 \
#     libxss1 \
#     libxtst6 \
#     lsb-release \
#     wget \
#     xdg-utils \
#     curl \
#     unzip

# # 1.2 Install Chinese fonts.
# RUN apt-get install -y \
#     fonts-noto-cjk \
#     fonts-wqy-microhei \
#     fonts-wqy-zenhei \
#     fonts-arphic-ukai \
#     fonts-arphic-uming

# # 2.1 Install Node.js
# ENV NVM_DIR=/root/.nvm
# ENV NODE_VERSION=20.17.0

# RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
#     && . $NVM_DIR/nvm.sh \
#     && nvm install $NODE_VERSION \
#     && nvm alias default $NODE_VERSION \
#     && nvm use default

# # Add NVM to PATH and set up shell
# ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin:${PATH}"
# ENV PATH="/usr/local/bin:${PATH}"

# # 2.2 Install pnpm.
# RUN npm install -g pnpm

# WORKDIR /app

# COPY . .


# # For ARM64 architecture, use specific flags for Puppeteer
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# # Install Chromium browser (works on ARM64)
# RUN apt-get update && apt-get install -y chromium

# RUN pnpm install

# RUN pnpm run build

# CMD ["node", "dist/app.js"]



FROM node:22.14.0-alpine

RUN apk add --no-cache \
    msttcorefonts-installer font-noto fontconfig \
    freetype ttf-dejavu ttf-droid ttf-freefont ttf-liberation \
    chromium \
  && rm -rf /var/cache/apk/* /tmp/*

RUN update-ms-fonts \
    && fc-cache -f

# Install Chinese fonts that are available in Alpine
RUN apk add --no-cache font-noto-cjk wqy-zenhei

# Install pnpm.
RUN npm install -g pnpm

# Replace Playwright with Puppeteer
RUN apk add --no-cache chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app


RUN addgroup pptruser \
    && adduser pptruser -D -G pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

USER pptruser


WORKDIR /app

COPY . .

RUN pnpm install

RUN pnpm run build

CMD ["node", "dist/app.js"]
