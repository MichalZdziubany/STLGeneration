# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Install OpenSCAD + CuraEngine CLIs for local geometry/slicing
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		git \
		openscad \
		cmake \
		ninja-build \
		build-essential \
		gcc-13 g++-13 \
		libssl-dev \
		libboost-all-dev \
		protobuf-compiler \
		libprotobuf-dev \
		pkg-config \
		libtbb-dev \
	&& rm -rf /var/lib/apt/lists/*

# Use GCC 13 as default
RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-13 50 && \
    update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-13 50

# Create dedicated virtualenv for Conan
RUN python -m venv /opt/conanenv
ENV PATH="/opt/conanenv/bin:${PATH}"

# Install Conan and configure
RUN pip install --upgrade pip && pip install conan==2.7.1 && \
    conan config install https://github.com/ultimaker/conan-config.git && \
    conan profile detect --force

# Clone and build CuraEngine from source (matching resources)
WORKDIR /opt
RUN git clone https://github.com/Ultimaker/CuraEngine.git
WORKDIR /opt/CuraEngine
RUN conan install . --build=missing --update -s compiler.cppstd=gnu20
RUN cmake --preset conan-release && cmake --build --preset conan-release
ENV PATH="/opt/CuraEngine/build:/opt/CuraEngine/build/Release:${PATH}"

# Clone Cura resources for machine definitions, materials, and quality profiles
RUN git clone --depth 1 https://github.com/Ultimaker/Cura.git /opt/Cura \
	&& mv /opt/Cura/resources /opt/cura-resources \
	&& rm -rf /opt/Cura

# Ensure base extruder definition is accessible under extruders for CuraEngine 5.0
RUN cp /opt/cura-resources/definitions/fdmextruder.def.json /opt/cura-resources/extruders/fdmextruder.def.json || true

# Expose resources path to the app and CuraEngine
ENV CURA_RESOURCES=/opt/cura-resources
ENV CURA_ENGINE_SEARCH_PATH=/opt/cura-resources

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files into container
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI using uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]