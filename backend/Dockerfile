# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Install OpenSCAD + CuraEngine CLIs for local geometry/slicing
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		openscad \
		cura-engine \
	&& rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files into container
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI using uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]