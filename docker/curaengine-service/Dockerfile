FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    cmake \
    build-essential \
    libboost-all-dev \
    protobuf-compiler \
    libprotobuf-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /opt/CuraEngine

# Clone CuraEngine source - use a specific stable tag
RUN git clone --depth 1 --branch 5.6.0 https://github.com/Ultimaker/CuraEngine.git . && \
    git submodule update --init --recursive

# Create build directory
RUN mkdir -p build
WORKDIR /opt/CuraEngine/build

# Run CMake with verbose output for debugging
RUN cmake .. -DCMAKE_BUILD_TYPE=Release

# Build with verbose output
RUN make -j$(nproc) VERBOSE=1

# Add CuraEngine to PATH
ENV PATH="/opt/CuraEngine/build:${PATH}"

# Default command
CMD ["CuraEngine", "--help"]