const path = require('path');

module.exports = {
  apps: [
    {
      name: 'servicall',
      cwd: path.resolve(__dirname),
      script: './dist/index.js',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 4000,
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
