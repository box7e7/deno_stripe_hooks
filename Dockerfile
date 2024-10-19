# Use the official Deno image as a base
FROM denoland/deno:alpine-1.29.1

# Set the working directory
WORKDIR /app

# Copy the necessary files
COPY . /app

# Set permissions for the .env file if it exists
RUN if [ -f ".env" ]; then chmod 600 .env; fi

# Install Stripe dependency via npm
RUN apk add --no-cache nodejs npm && npm install stripe@11.16

# Expose the application port
EXPOSE 5050

# Run the Deno script
CMD ["run", "--allow-net", "--allow-read", "--allow-env", "server.js"]
