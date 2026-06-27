#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
step()  { echo -e "\n${CYAN}=======================================================================${NC}"; echo -e "  ${GREEN}$1${NC}"; echo -e "${CYAN}=======================================================================${NC}"; }
info()  { echo -e "  ${YELLOW}$1${NC}"; }
trim()  { tr -d '\r'; }

step "[1/8] Verificando Azure CLI..."
if ! command -v az &>/dev/null; then echo "ERROR: Azure CLI no instalado"; exit 1; fi
if ! az account show &>/dev/null; then az login --use-device-code; fi
info "Usuario: $(az account show --query user.name -o tsv | trim) | Sub: $(az account show --query name -o tsv | trim)"

step "[2/8] Leyendo .env con Python..."
python3 -c "
import json, sys
env = {}
try:
    with open('.env', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k, _, v = line.partition('=')
            v = v.strip().strip('\"').strip(\"'\")
            env[k.strip()] = v
    with open('/tmp/cavaltec-env.json', 'w', encoding='utf-8') as out:
        json.dump(env, out)
    print('OK: ' + str(len(env)) + ' variables')
except Exception as e:
    print('ERROR: ' + str(e), file=sys.stderr)
    sys.exit(1)
"
get_env() { python3 -c "import json; d=json.load(open('/tmp/cavaltec-env.json')); print(d.get('$1',''))"; }
[ -z "$(get_env FIREBASE_PROJECT_ID)" ] && { echo "ERROR: .env mal formado"; exit 1; }
info "Variables leidas: FIREBASE_PROJECT_ID=$(get_env FIREBASE_PROJECT_ID)"

step "[3/8] Generando recursos..."
if [ -n "${1:-}" ]; then
  SUFFIX="$1"
elif [ -n "${SUFFIX:-}" ]; then
  SUFFIX="$SUFFIX"
else
  SUFFIX=$(python3 -c "import time,hashlib; print(hashlib.sha256(str(time.time()).encode()).hexdigest()[:8])")
fi
RG="cavaltec-rg-${SUFFIX}"; LOC="${LOCATION:-eastus2}"; ACR="cavaltec${SUFFIX}"
ACA_ENV="cavaltec-env-${SUFFIX}"; STG="cavstg${SUFFIX}"
PG_PASS=$(python3 -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(24)))")
JWT=$(python3 -c "import secrets; print(secrets.token_urlsafe(40))")
info "RG: $RG | ACR: $ACR"

step "[4/8] Service Principal..."
SP_NAME="cavaltec-sp-${SUFFIX}"; TENANT=$(az account show --query tenantId -o tsv | trim)
SP_ID=$(az ad sp list --display-name "$SP_NAME" --query "[0].appId" -o tsv | trim 2>/dev/null || true)
if [ -n "$SP_ID" ]; then
  info "Reutilizando SP: $SP_ID"
  SP_SECRET=$(az ad sp credential reset --id "$SP_ID" --query password -o tsv | trim 2>/dev/null || true)
  [ -z "$SP_SECRET" ] && SP_SECRET=$(az ad sp credential reset --id "$SP_ID" --query password -o tsv | trim)
else
  info "Creando SP..."
  SP_OUT=$(az ad sp create-for-rbac --name "$SP_NAME" -o json 2>/dev/null || true)
  if echo "$SP_OUT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    SP_ID=$(echo "$SP_OUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")
    SP_SECRET=$(echo "$SP_OUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
    info "SP: $SP_ID"
  else
    info "No se pudo crear SP. Se usara DeviceCodeCredential."
    SP_ID=""; SP_SECRET=""
  fi
fi

step "[5/8] RG + ACR + Build..."
az group create --name "$RG" --location "$LOC" --output none
az acr create -g "$RG" -n "$ACR" --sku Basic --admin-enabled true --output none
az acr login --name "$ACR" > /dev/null
ACR_LOGIN=$(az acr show -n "$ACR" --query loginServer -o tsv | trim)
info "Construyendo API..."
if ! docker build -t "$ACR_LOGIN/cavaltec-api:latest" ./api; then
  echo "ERROR: Docker build API fallo"; exit 1
fi
if ! docker push "$ACR_LOGIN/cavaltec-api:latest"; then
  echo "ERROR: Docker push API fallo"; exit 1
fi
info "Construyendo Frontend..."
if ! docker build -t "$ACR_LOGIN/cavaltec-frontend:latest" ./frontend; then
  echo "ERROR: Docker build Frontend fallo"; exit 1
fi
if ! docker push "$ACR_LOGIN/cavaltec-frontend:latest"; then
  echo "ERROR: Docker push Frontend fallo"; exit 1
fi

step "[6/8] Storage..."
az storage account create -g "$RG" -n "$STG" --sku Standard_LRS --output none
STG_KEY=$(az storage account keys list -g "$RG" -n "$STG" --query "[0].value" -o tsv | trim)
az storage share create --account-name "$STG" --account-key "$STG_KEY" -n "postgres-data" --output none

step "[7/8] ACA Env + PostgreSQL..."
az containerapp env create -g "$RG" --name "$ACA_ENV" --location "$LOC" --output none

info "Registrando Azure Files storage en el environment..."
az containerapp env storage set -g "$RG" --name "$ACA_ENV" \
  --storage-name pgdata \
  --azure-file-account-name "$STG" \
  --azure-file-account-key "$STG_KEY" \
  --azure-file-share-name postgres-data \
  --access-mode ReadWrite \
  --output none

info "Generando YAML para PostgreSQL..."
ACA_ENV_ID=$(az containerapp env show -g "$RG" --name "$ACA_ENV" --query id -o tsv | trim)
# Get Windows temp path (az.exe no entiende rutas Unix como /tmp/)
WINDOWS_TEMP=$(cmd //c echo %TEMP% 2>/dev/null | tr -d '\r' || echo "$TMPDIR")
YAML_PATH="${WINDOWS_TEMP}\\cavaltec-postgres.yaml"
python3 "$SCRIPT_DIR/gen-postgres-yaml.py" "$PG_PASS" "$YAML_PATH" "$ACA_ENV_ID" "$LOC"
PG_EXISTS=$(az containerapp show -g "$RG" -n cavaltec-postgres --query name -o tsv 2>/dev/null || true)
if [ -n "$PG_EXISTS" ]; then
  info "PostgreSQL ya existe, actualizando..."
  az containerapp update --yaml "$YAML_PATH" --output none
else
  az containerapp create --yaml "$YAML_PATH" --output none
fi

PG_FQDN=$(az containerapp show -g "$RG" -n cavaltec-postgres --query "properties.configuration.ingress.fqdn" -o tsv | trim)
info "PostgreSQL: $PG_FQDN"
info "Esperando 20s a que PostgreSQL arranque..."
sleep 20

step "[8/8] API + Frontend..."

python3 -c "
import json
pg_pass = '$PG_PASS'
pg_fqdn = '$PG_FQDN'
env = json.load(open('/tmp/cavaltec-env.json'))
api_env = {
    'DATABASE_URL': 'postgresql://postgres:' + pg_pass + '@' + pg_fqdn + ':5432/cavaltec',
    'POSTGRES_HOST': pg_fqdn,
    'POSTGRES_PORT': '5432',
    'POSTGRES_DB': 'cavaltec',
    'POSTGRES_USER': 'postgres',
    'POSTGRES_PASSWORD': pg_pass,
    'FIREBASE_PROJECT_ID': env.get('FIREBASE_PROJECT_ID',''),
    'FIREBASE_CLIENT_EMAIL': env.get('FIREBASE_CLIENT_EMAIL',''),
    'AZURE_FOUNDRY_ENDPOINT': env.get('AZURE_FOUNDRY_ENDPOINT',''),
    'AZURE_FOUNDRY_API_KEY': env.get('AZURE_FOUNDRY_API_KEY',''),
    'AZURE_FOUNDRY_MODEL': env.get('AZURE_FOUNDRY_MODEL',''),
    'AZURE_FOUNDRY_API_VERSION': env.get('AZURE_FOUNDRY_API_VERSION',''),
    'AZURE_AI_PROJECT_ENDPOINT': env.get('AZURE_AI_PROJECT_ENDPOINT',''),
    'AZURE_AI_AGENT_ID': env.get('AZURE_AI_AGENT_ID',''),
    'ADMIN_EMAIL': env.get('ADMIN_EMAIL',''),
    'JWT_SECRET': '$JWT',
    'ENVIRONMENT': 'production',
    'BACKEND_CORS_ORIGINS': json.dumps(['*']),
    'AZURE_TENANT_ID': '$TENANT',
    'AZURE_CLIENT_ID': '$SP_ID',
    'AZURE_CLIENT_SECRET': '$SP_SECRET',
}
with open('/tmp/cavaltec-api-env.json', 'w') as f:
    json.dump(api_env, f)

fe_env = {
    'API_URL': 'https://API_FQDN_PLACEHOLDER',
    'VITE_FIREBASE_API_KEY': env.get('VITE_FIREBASE_API_KEY',''),
    'VITE_FIREBASE_AUTH_DOMAIN': env.get('VITE_FIREBASE_AUTH_DOMAIN',''),
    'VITE_FIREBASE_PROJECT_ID': env.get('VITE_FIREBASE_PROJECT_ID',''),
    'VITE_FIREBASE_STORAGE_BUCKET': env.get('VITE_FIREBASE_STORAGE_BUCKET',''),
    'VITE_FIREBASE_MESSAGING_SENDER_ID': env.get('VITE_FIREBASE_MESSAGING_SENDER_ID',''),
    'VITE_FIREBASE_APP_ID': env.get('VITE_FIREBASE_APP_ID',''),
}
with open('/tmp/cavaltec-fe-env.json', 'w') as f:
    json.dump(fe_env, f)
"

api_args=()
while IFS='=' read -r k v; do
  [ -n "$k" ] && [ -n "$v" ] && api_args+=("$k=$v")
done < <(python3 -c "import json; d=json.load(open('/tmp/cavaltec-api-env.json')); [print(k+'='+v) for k,v in d.items() if v]")

FIREBASE_PK="$(get_env FIREBASE_PRIVATE_KEY)"
if [ -n "$FIREBASE_PK" ]; then
  info "Creando API (con Firebase secret)..."
  az containerapp create -g "$RG" --name cavaltec-api --environment "$ACA_ENV" \
    --image "$ACR_LOGIN/cavaltec-api:latest" --registry-server "$ACR_LOGIN" \
    --target-port 8000 --ingress external \
    --min-replicas 1 --max-replicas 3 --cpu 0.5 --memory 1.0Gi \
    --secrets "firebase-pk=$FIREBASE_PK" \
    --env-vars "${api_args[@]}" "FIREBASE_PRIVATE_KEY=secretref:firebase-pk" --output none
else
  info "Creando API (sin Firebase key)..."
  az containerapp create -g "$RG" --name cavaltec-api --environment "$ACA_ENV" \
    --image "$ACR_LOGIN/cavaltec-api:latest" --registry-server "$ACR_LOGIN" \
    --target-port 8000 --ingress external \
    --min-replicas 1 --max-replicas 3 --cpu 0.5 --memory 1.0Gi \
    --env-vars "${api_args[@]}" --output none
fi

API_FQDN=$(az containerapp show -g "$RG" -n cavaltec-api --query "properties.configuration.ingress.fqdn" -o tsv | trim)
info "API: https://$API_FQDN"

python3 -c "
import json
d = json.load(open('/tmp/cavaltec-fe-env.json'))
d['API_URL'] = 'https://' + '$API_FQDN'
with open('/tmp/cavaltec-fe-env.json', 'w') as f:
    json.dump(d, f)
"
fe_args=()
while IFS='=' read -r k v; do
  [ -n "$k" ] && [ -n "$v" ] && fe_args+=("$k=$v")
done < <(python3 -c "import json; d=json.load(open('/tmp/cavaltec-fe-env.json')); [print(k+'='+v) for k,v in d.items() if v]")

info "Creando Frontend..."
az containerapp create -g "$RG" --name cavaltec-frontend --environment "$ACA_ENV" \
  --image "$ACR_LOGIN/cavaltec-frontend:latest" --registry-server "$ACR_LOGIN" \
  --target-port 80 --ingress external \
  --min-replicas 1 --max-replicas 3 --cpu 0.25 --memory 0.5Gi \
  --env-vars "${fe_args[@]}" --output none

FE_FQDN=$(az containerapp show -g "$RG" -n cavaltec-frontend --query "properties.configuration.ingress.fqdn" -o tsv | trim)

echo ""
echo "==============================================="
echo -e "  ${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo "==============================================="
echo ""
echo "  Frontend : https://$FE_FQDN"
echo "  API      : https://$API_FQDN"
echo ""
echo "  RG: $RG"
echo ""
if [ -n "${SP_ID:-}" ]; then
  echo "  -- Service Principal --"
  echo "  Tenant: $TENANT"
  echo "  Client ID: $SP_ID"
  echo "  Secret: $SP_SECRET"
  echo ""
  echo "  Grant SP access at https://ai.azure.com then restart API:"
  echo "  az containerapp restart -g $RG -n cavaltec-api"
  echo ""
fi
echo "  Logs API: az containerapp logs show -g $RG -n cavaltec-api --follow"
echo "  Logs FE:  az containerapp logs show -g $RG -n cavaltec-frontend --follow"
echo "  Delete:   az group delete --name $RG --yes"
