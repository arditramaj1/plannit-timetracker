#!/bin/bash
set -e

if [[ -S /var/run/docker.sock ]]; then
  docker_socket_gid="$(stat -c '%g' /var/run/docker.sock)"
  docker_group_name="$(getent group "${docker_socket_gid}" | cut -d: -f1 || true)"

  if [[ -z "${docker_group_name}" ]]; then
    docker_group_name="docker-host"

    if getent group "${docker_group_name}" >/dev/null 2>&1; then
      sudo groupmod --gid "${docker_socket_gid}" "${docker_group_name}"
    else
      sudo groupadd --gid "${docker_socket_gid}" "${docker_group_name}"
    fi
  fi

  sudo usermod -aG "${docker_group_name}" ubuntu
fi

sudo chown -R ubuntu:ubuntu /home/ubuntu
sudo chown -R ubuntu:ubuntu /workspace

