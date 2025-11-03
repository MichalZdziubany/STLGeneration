# Use official Ubuntu 22.04 image
FROM ubuntu:22.04

# Install OpenSCAD CLI
RUN apt-get update && apt-get install -y openscad \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory to /data (where files will be mounted)
WORKDIR /data

# When container starts, run OpenSCAD CLI
ENTRYPOINT ["openscad"]
