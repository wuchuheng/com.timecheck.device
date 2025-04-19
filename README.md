# URL Renderer

A lightweight, high-performance web page rendering service designed for Orange Pi Zero 3 and other ARM64 devices. This Docker-based solution can render web pages and capture screenshots using Playwright with minimal resource requirements.

## Features

- **Efficient Rendering**: Renders web pages using Playwright in a resource-constrained environment
- **Screenshot Capture**: Takes screenshots of rendered pages
- **REST API**: Simple API for integration with other services
- **Low Resource Consumption**: Runs on devices with as little as 1GB RAM
- **Docker Support**: Easy deployment across ARM64 devices

## Requirements

- Orange Pi Zero 3 or any ARM64-based Linux device
- Docker installed
- At least 1GB RAM
- Internet connection

## Installation

### Using Docker (Recommended)

Pull the latest Docker image from GitHub Container Registry:

```bash
docker pull ghcr.io/wuchuheng/com.timecheck.device:latest
```

Run the container:

```bash
docker run -d \
  --name timecheck-renderer \
  -p 3000:3000 \
  ghcr.io/com.timecheck/com.timecheck.device.v3:latest
```

### Building from Source

1. Clone the repository:

```bash
git clone https://github.com/wuchuheng/com.timecheck.device
cd com.timecheck.device
```

2. Build the Docker image:

```bash
docker build -t timecheck-renderer .
```

3. Run the container:

```bash
docker run -d \
  --name timecheck-renderer \
  -p 3000:3000 \
  timecheck-renderer
```

## API Usage

### Render URL

Renders a web page and returns both the HTML content and a screenshot.

**Endpoint:** `/api/render-url`

**Method:** GET

**Parameters:**
- `url` (required): The URL to render

**Example Request:**
```
GET /api/render-url?url=https://example.com
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "html": "<!DOCTYPE html><html>...</html>",
    "timeTaken": 10.019,
    "screenshot": "http://192.168.0.107:3000/screenshots/screenshot.png"
  }
}
```

## Performance Considerations

- The service is optimized to run on low-resource devices (1GB RAM minimum)
- For better performance, consider limiting concurrent requests
- First-time page rendering might be slower due to browser initialization

## Troubleshooting

- If the service fails to start, check if the device has enough memory available
- Ensure the Docker service is running correctly
- Verify that the device has internet access to fetch web pages

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Playwright](https://playwright.dev/) for web page rendering
- [Docker](https://www.docker.com/) for containerization
- Orange Pi community for hardware support 