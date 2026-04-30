FROM node:20

# 1. Install the drawing libraries needed for the Canvas rank card
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev

# 2. Create app directory
WORKDIR /usr/src/app

# 3. Copy package files
COPY package*.json ./

# 4. Use 'npm install' because we deleted the lockfile
RUN npm install

# 5. Copy the rest of your bot's code
COPY . .

# 6. Start the bot
CMD [ "npm", "start" ]
