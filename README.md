# k8s-monitoring

A queue-based job system on a local kind cluster. The API enqueues work in Redis through BullMQ. Workers run the jobs and scale with a Horizontal Pod Autoscaler. A stats service reads the counters. Prometheus scrapes metrics and Grafana shows them.

```
client -- :80 --> Ingress --> api (ClusterIP)
                              |
                              v
                           Redis / BullMQ
                              |
                              v
                           worker (HPA)
                              |
                              v
                           stats (ClusterIP, internal)
```

## Prerequisites

- Docker, or Colima with at least 5 GiB of VM memory
- kind
- kubectl
- Helm
- pnpm
- ApacheBench (`ab`)

## Deploy

Create the cluster named `queue`. Port 80 and 443 are published for ingress-nginx. Port 30080 is published on `127.0.0.1` for Grafana.

```bash
kind create cluster --name queue --config kind-config.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=180s
./scripts/install-metrics-server.sh
```

Build the three images and load them into kind. The cluster will not pull `queue-*:latest` from a registry.

```bash
docker build -f Dockerfile --build-arg SERVICE=api -t queue-api:latest .
docker build -f Dockerfile --build-arg SERVICE=worker -t queue-worker:latest .
docker build -f Dockerfile --build-arg SERVICE=stats -t queue-stats:latest .
kind load docker-image queue-api:latest queue-worker:latest queue-stats:latest --name queue
```

Apply the app manifests in filename order, then install kube-prometheus-stack and the scrape config. The Helm release name `prometheus` matches the Service names used below.

```bash
kubectl apply -f k8s/00-namespace-config.yaml
kubectl apply -f k8s/10-redis.yaml
kubectl apply -f k8s/20-api.yaml
kubectl apply -f k8s/30-worker.yaml
kubectl apply -f k8s/40-ingress.yaml
kubectl apply -f k8s/50-hpa.yaml
kubectl apply -f k8s/60-stats.yaml
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f monitoring/values.yaml
kubectl apply -f monitoring/servicemonitors.yaml
kubectl apply -f monitoring/worker-dashboard.yaml
kubectl apply -f monitoring/stats-dashboard.yaml
```

The JSON copies under `monitoring/dashboards/` are for manual Grafana import. They must stay in sync with those ConfigMaps.

## Accessing services

- API through the Ingress: `http://127.0.0.1/` (port 80). Use `127.0.0.1`, not `localhost`, so `ab` does not try IPv6.
- Grafana: `http://127.0.0.1:30080`. User `admin`, password `admin`. The kind port mapping binds this port to localhost only.
- Prometheus has no host port. Forward it:

```bash
kubectl -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090
```

## API reference

`POST /submit` and `GET /submit` both enqueue one job and return `202` with `{ "id", "type" }`. The body is optional. When `type` is omitted the API picks one of `primes`, `bcrypt`, `sort`, or `memory`. `GET /submit` exists so a load test can call the URL without a body. It still enqueues a job.

`GET /status/:id` returns the job state and result while the job is still retained. Completed jobs are kept for 1 hour or 1000 jobs, whichever comes first. Failed jobs are kept for 1 day or 1000 jobs.

`GET /stats` is served by the stats Deployment inside the cluster on port 3100. It is not on the Ingress. It returns submitted, completed, failed, queue length, active jobs, and average processing seconds.

`GET /metrics` on the worker (port 9100) and on stats (port 3100) returns Prometheus text. The API and worker also serve `GET /health`.

## Stress test

Raise the open-file limit, then send the assignment command. Lower `-c` if the client starts failing requests.

```bash
ulimit -n 10240
ab -k -n 5000 -c 200 http://127.0.0.1/submit
```

The same load with an explicit JSON body:

```bash
ab -k -n 5000 -c 200 -p loadtest/body.json -T application/json http://127.0.0.1/submit
```

`loadtest/body.json` is `{}`, so the API chooses the job type. Use `127.0.0.1`, not `localhost`.

## Design notes

BullMQ stores the queue in Redis and lets the API process stay separate from the CPU work. Workers can scale without taking HTTP traffic.

The worker HPA keeps at least 2 pods and at most 10. It targets 70% of the container CPU request (100m). Scale-up has no stabilization window and may double the replica count every 30 seconds. Scale-down waits 120 seconds and removes at most 2 pods per minute.

Redis is one StatefulSet replica with AOF (`appendonly`, `appendfsync everysec`) and `noeviction`. Replication is not configured, so the replica count must stay 1. A headless Service backs the StatefulSet. The `redis` ClusterIP Service is what the apps use.

kind has no cloud load balancer. `extraPortMappings` in `kind-config.yaml` publish host ports into the node, and ingress-nginx binds host ports 80 and 443. The API Service stays ClusterIP and is only reached through the Ingress.

`GET /submit` has the same side effect as POST. That is only so `ab` can hit a URL with no body.

## Results and observations

![alt text](<results/Screenshot 2026-10-09 at 18.42.27.png>) ![alt text](<results/Screenshot 2026-10-09 at 18.42.49.png>) ![alt text](<results/Screenshot 2026-10-09 at 19.03.38.png>) ![alt text](<results/Screenshot 2026-10-09 at 19.04.25.png>) ![alt text](<results/Screenshot 2026-10-09 at 19.04.40.png>)
