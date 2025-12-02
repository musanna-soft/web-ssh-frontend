# Web SSH Frontend

This is the frontend component of the Web SSH application, built with Vue 3 and Vite. It provides a web interface for connecting to SSH servers.

## Features

- **Terminal Copy/Paste**:
  - **Auto-copy on selection**: Selected text is automatically copied to clipboard
  - **Ctrl+Shift+C**: Manual copy with visual feedback (prevents dev tools from opening)
  - **Ctrl+Shift+V**: Paste from clipboard (native browser functionality)
- **WebSocket Keepalive**: Client-side ping mechanism to maintain connection during idle periods
- **Auto-reconnection**: Automatic reconnection with exponential backoff (up to 5 attempts)
- **Google OAuth Integration**: Secure user authentication
- **Multi-server Management**: Connect to multiple SSH servers simultaneously
- **File Manager**: Browse and manage files via SFTP

## 1. Configuration (.env)

Before running the application, you need to configure the environment variables.

1.  Copy the example configuration file:
    ```bash
    cp .env.example .env.production
    ```
    *Note: Use `.env.development` for local development.*

2.  Open the file and set the `VITE_API_BASE_URL` to point to your backend server:
    ```properties
    VITE_API_BASE_URL=http://localhost:8080
    ```

## 2. Running with Docker

The project is fully containerized. Follow these steps to run it with Docker:

### Build the Image

```bash
docker build -t web-ssh-frontend .
```

### Run the Container

```bash
docker run -d -p 8081:80 web-ssh-frontend
```

This will start the application on port 8081. You can access it at `http://localhost:8081`.

## 3. Development

To run the application locally for development:

```bash
npm install
npm run dev
```

## Additional Information

This project uses Vue 3 `<script setup>` SFCs. For more information, check out the [Vue 3 Documentation](https://vuejs.org/).
