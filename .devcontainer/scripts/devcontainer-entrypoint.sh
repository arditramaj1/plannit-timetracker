#!/usr/bin/env bash
set -euo pipefail

load_env_file() {
  local env_file="$1"

  if [[ ! -f "${env_file}" ]]; then
    return 0
  fi

  local postgres_db_was_set="${POSTGRES_DB+x}"
  local postgres_db_value="${POSTGRES_DB-}"
  local postgres_user_was_set="${POSTGRES_USER+x}"
  local postgres_user_value="${POSTGRES_USER-}"
  local postgres_password_was_set="${POSTGRES_PASSWORD+x}"
  local postgres_password_value="${POSTGRES_PASSWORD-}"
  local postgres_host_was_set="${POSTGRES_HOST+x}"
  local postgres_host_value="${POSTGRES_HOST-}"
  local postgres_port_was_set="${POSTGRES_PORT+x}"
  local postgres_port_value="${POSTGRES_PORT-}"

  set -a
  # shellcheck disable=SC1090
  . "${env_file}"
  set +a

  if [[ -n "${postgres_db_was_set}" ]]; then
    export POSTGRES_DB="${postgres_db_value}"
  fi

  if [[ -n "${postgres_user_was_set}" ]]; then
    export POSTGRES_USER="${postgres_user_value}"
  fi

  if [[ -n "${postgres_password_was_set}" ]]; then
    export POSTGRES_PASSWORD="${postgres_password_value}"
  fi

  if [[ -n "${postgres_host_was_set}" ]]; then
    export POSTGRES_HOST="${postgres_host_value}"
  fi

  if [[ -n "${postgres_port_was_set}" ]]; then
    export POSTGRES_PORT="${postgres_port_value}"
  fi
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
    return
  fi

  sudo -- "$@"
}

run_as_postgres() {
  if [[ "$(id -un)" == "postgres" ]]; then
    "$@"
    return
  fi

  sudo -u postgres -- "$@"
}

start_postgres() {
  local cluster_info
  local pg_version
  local pg_cluster
  local pg_port
  local pg_status

  cluster_info="$(pg_lsclusters --no-header | awk 'NR==1 {print $1, $2, $3, $4}')"

  if [[ -z "${cluster_info}" ]]; then
    pg_version="$(psql -V | awk '{split($3, version_parts, "."); print version_parts[1]}')"
    run_as_root pg_createcluster "${pg_version}" main >/dev/null
    cluster_info="$(pg_lsclusters --no-header | awk 'NR==1 {print $1, $2, $3, $4}')"
  fi

  read -r pg_version pg_cluster pg_port pg_status <<<"${cluster_info}"

  if [[ "${pg_status}" != "online" ]]; then
    run_as_root pg_ctlcluster "${pg_version}" "${pg_cluster}" start
    cluster_info="$(pg_lsclusters --no-header | awk 'NR==1 {print $1, $2, $3, $4}')"
    read -r pg_version pg_cluster pg_port pg_status <<<"${cluster_info}"
  fi

  if [[ "${pg_status}" != "online" ]]; then
    echo "PostgreSQL cluster ${pg_version}/${pg_cluster} failed to start." >&2
    exit 1
  fi

  printf '%s\n' "${pg_port}"
}

wait_for_postgres() {
  local pg_port="$1"
  local attempt

  for attempt in $(seq 1 30); do
    if pg_isready --host=127.0.0.1 --port="${pg_port}" >/dev/null 2>&1; then
      return 0
    fi

    sleep 1
  done

  echo "PostgreSQL did not become ready on port ${pg_port}." >&2
  exit 1
}

configure_database() {
  run_as_postgres psql \
    --dbname=postgres \
    --set=ON_ERROR_STOP=1 \
    --set=db_name="${POSTGRES_DB}" \
    --set=db_user="${POSTGRES_USER}" \
    --set=db_password="${POSTGRES_PASSWORD}" <<'SQL'
DO
$$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'db_user') THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_password');
    END IF;
END
$$;

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = :'db_name'
)\gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'db_user')
WHERE EXISTS (
    SELECT FROM pg_database WHERE datname = :'db_name'
)\gexec
SQL
}

load_env_file /workspace/.env
load_env_file /workspace/backend/.env

export POSTGRES_DB="${POSTGRES_DB:-plannit}"
export POSTGRES_USER="${POSTGRES_USER:-plannit}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-plannit}"
export POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"

pg_port="$(start_postgres)"
wait_for_postgres "${pg_port}"
configure_database

if [[ "$#" -eq 0 ]]; then
  set -- sleep infinity
fi

if [[ -x /usr/local/share/docker-init.sh ]]; then
  exec /usr/local/share/docker-init.sh "$@"
fi

exec "$@"
