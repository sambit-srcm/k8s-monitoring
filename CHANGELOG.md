# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- API that enqueues a BullMQ job on `POST /submit` and `GET /submit`, and returns job status while the job is retained.
- Worker for the `primes`, `bcrypt`, `sort`, and `memory` job types, with Prometheus metrics on port 9100.
- Stats service that reads the Redis counters and the queue depth.
- kind manifests for the `queue-system` namespace, a worker Horizontal Pod Autoscaler, Prometheus ServiceMonitors, and Grafana dashboards.
