import sys, json, os

pg_pass = sys.argv[1]
output_path = sys.argv[2] if len(sys.argv) > 2 else "cavaltec-postgres.yaml"
env_id = sys.argv[3] if len(sys.argv) > 3 else ""
location = sys.argv[4] if len(sys.argv) > 4 else "eastus2"

yaml = f"""type: Microsoft.App/containerApps
apiVersion: 2023-05-01
name: cavaltec-postgres
location: {location}
properties:
  environmentId: {env_id}
  configuration:
    ingress:
      external: false
      targetPort: 5432
      transport: auto
    secrets:
    - name: pg-pass
      value: "{pg_pass}"
  template:
    containers:
    - name: cavaltec-postgres
      image: docker.io/library/postgres:16
      resources:
        cpu: "0.5"
        memory: 1.0Gi
      env:
      - name: POSTGRES_DB
        value: cavaltec
      - name: POSTGRES_USER
        value: postgres
      - name: POSTGRES_PASSWORD
        secretRef: pg-pass
      volumeMounts:
      - volumeName: pgdata
        mountPath: /var/lib/postgresql/data
    scale:
      minReplicas: 1
      maxReplicas: 1
    volumes:
    - name: pgdata
      storageType: AzureFile
      storageName: pgdata
"""

with open(output_path, "w", newline="\n") as f:
    f.write(yaml)
print("YAML written to " + output_path)