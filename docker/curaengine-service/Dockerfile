# Base Ubuntu image
FROM ubuntu:22.04

# Install wget for downloading prebuilt binary
RUN apt-get update && apt-get install -y wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Download prebuilt CuraEngine AppImage
RUN wget -O /usr/local/bin/CuraEngine \
    https://github.com/Ultimaker/CuraEngine/releases/download/5.6.1/CuraEngine-5.6.1-linux.AppImage \
    && chmod +x /usr/local/bin/CuraEngine

# Set working directory to /data
WORKDIR /data

# Run CuraEngine when container starts
ENTRYPOINT ["CuraEngine"]
