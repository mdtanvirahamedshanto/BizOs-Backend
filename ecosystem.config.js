module.exports = {
  apps: [
    {
      name: 'bizos-api',
      script: './dist/server.js',
      instances: 'max', // Uses all available CPU cores (e.g. 2 instances on a dual-core)
      exec_mode: 'cluster',
      max_memory_restart: '768M', // Restarts if a leak happens
      node_args: '--max-old-space-size=768', // Strict GC limit
      env: {
        NODE_ENV: 'production',
        UV_THREADPOOL_SIZE: '4'
      }
    },
    {
      name: 'bizos-worker',
      script: './dist/workers/index.js',
      instances: 1, // Only 1 worker needed for background jobs
      max_memory_restart: '512M',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'bizos-bot',
      script: './dist/bot/index.js',
      instances: 1, // Only 1 Telegram bot listener allowed
      max_memory_restart: '256M',
      node_args: '--max-old-space-size=256',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
