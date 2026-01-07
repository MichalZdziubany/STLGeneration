FROM ubuntu:24.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-venv \
    cmake \
    ninja-build \
    build-essential \
    gcc-13 g++-13 \
    libssl-dev \
    libboost-all-dev \
    protobuf-compiler \
    libprotobuf-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Use GCC 13 as default
RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-13 50 && \
    update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-13 50

# Create dedicated virtualenv for Conan (clean & safe)
RUN python3 -m venv /opt/conanenv
ENV PATH="/opt/conanenv/bin:${PATH}"

# Install Conan inside venv
RUN pip install --upgrade pip && \
    pip install conan==2.7.1

# Configure Conan
RUN conan config install https://github.com/ultimaker/conan-config.git
RUN conan profile detect --force


# Clone CuraEngine 5.11.0 (stable)
WORKDIR /opt
RUN git clone --depth 1 --branch 5.11.0 https://github.com/Ultimaker/CuraEngine.git

# Build directory
WORKDIR /opt/CuraEngine/build

RUN apt-get update && apt-get install -y libtbb-dev

# Conan dependency install
RUN conan install .. --build=missing --update -s compiler.cppstd=gnu20

# CMake configure + build
WORKDIR /opt/CuraEngine
RUN cmake --preset conan-release
RUN cmake --build --preset conan-release

# Add CuraEngine to PATH (release build directory)
ENV PATH="/opt/CuraEngine/build/Release:${PATH}"

# Keep container alive for docker exec usage and allow quick version check
CMD ["bash", "-lc", "CuraEngine --version || /opt/CuraEngine/build/Release/CuraEngine --version; tail -f /dev/null"]