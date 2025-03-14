# Stage 1: Build the React app
FROM node:16-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json / yarn.lock
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Build the production bundle
RUN npm run build

# Stage 2: Serve the React build with Nginx
FROM nginx:alpine

# Remove default nginx index page
RUN rm -rf /usr/share/nginx/html/*

# Copy the React build output to Nginx html folder
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
