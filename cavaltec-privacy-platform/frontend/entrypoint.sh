#!/bin/sh
set -e

# Generate nginx config from template, substituting only ${API_URL}
envsubst '${API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
