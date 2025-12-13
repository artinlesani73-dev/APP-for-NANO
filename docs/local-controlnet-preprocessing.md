# Local ControlNet Preprocessing Service

This document covers: (1) a method to test the capabilities of a customer-hosted server, (2) a detailed specification for a local ControlNet preprocessing feature, and (3) a test plan to verify capabilities and functional correctness. The deployment target for both administrators and end users is **Windows desktop environments**.

## 1. Capability Test Methodology

Goal: quickly assess whether the on-prem server can run ControlNet preprocessors (depth, line art, edge detectors) within acceptable latency and memory budgets.

1. **Hardware + runtime probe (CLI):**
   - Script name: `tools/probe_capabilities.py` (see implementation spec below) runnable via `python tools/probe_capabilities.py` on Windows PowerShell or Command Prompt.
   - Collects: GPU model + compute capability (via `nvidia-smi.exe` in the NVIDIA driver path or PyTorch), GPU memory, CPU cores/flags, RAM, OS build, CUDA/cuDNN versions, Python and Torch versions.
   - Output: JSON + human-readable summary saved to `./probe-report.json` and `./probe-report.txt`.
2. **Model warmup test:**
   - Load each configured preprocessor once (depth, canny, mlsd/line art) and run a single 512×512 inference on a synthetic image.
   - Capture load time, first-pass latency, peak GPU/CPU memory, and any errors.
3. **Sustained throughput test (optional):**
   - Run N=10 sequential inferences per preprocessor at 512×512 and 768×768.
   - Report average/median latency, max latency, and whether memory stayed below configured ceilings.
4. **Pass/fail heuristics:**
   - GPU available OR CPU-only mode allowed.
   - Peak GPU memory for 768×768 depth ≤ 6 GB (configurable); CPU RAM ≤ 8 GB.
   - P50 latency for 512×512 ≤ 1.5s on GPU or ≤ 6s on CPU (configurable thresholds).
5. **Report ingestion:**
   - Probe writes `probe-report.json`; service startup can optionally ingest and log the probe results.

### Probe CLI inputs
- `--preprocessors`: comma-separated list (e.g., `depth,canny,hed,mlsd`).
- `--resolution`: max resolution for tests (default 768).
- `--runs`: iterations per preprocessor (default 3 warm + 10 measured).
- `--cpu-only`: force CPU mode.
- `--output`: path for reports (Windows paths supported, e.g., `C:\data\probe-report.json`).

## 2. Detailed Feature Specification

### Objective
Provide an on-premise preprocessing service that converts user images into ControlNet conditioning maps (depth, line art/edges) via a REST API, offloading heavy work from Windows user desktops.

### Components
1. **Preprocessing Worker (FastAPI + PyTorch):**
   - Runs on Windows (Server or Pro) with Python 3.10+ installed; tested via PowerShell.
   - Loads configured preprocessors at startup using `controlnet-aux` or equivalent.
   - Supports GPU acceleration with FP16 when available; falls back to CPU.
   - Implements health/readiness endpoints and metrics.
2. **Client SDK/Adapter:**
   - Lightweight library to submit images to the local worker and retrieve maps from Windows desktop clients.
   - Handles retries/backoff, timeouts, and optional client-side downscaling.
3. **Capability Probe (CLI):**
   - Used by admins to validate the server before enabling production use.

### API
- `POST /preprocess/{type}`
  - `type`: `depth`, `canny`, `hed`, `mlsd`, `line_art`.
  - Request body (JSON + base64 image or multipart):
    - `image`: base64 PNG/JPEG or multipart file.
    - Optional: `max_size` (int, px), `canny_low`, `canny_high`, `detect_resolution`, `seed`, `prompt_id`.
  - Response:
    - `map`: base64 PNG of conditioning result.
    - `type`, `input_shape`, `output_shape`, `device`, `latency_ms`, `version`, `warnings`.
- `GET /healthz`: returns `status=ok`.
- `GET /readyz`: checks model load status.
- `GET /metrics`: Prometheus metrics.
- `POST /probe`: optionally triggers the capability probe and returns summary.

### Configuration
- **Env/config file:** selectable preprocessors, device preference (`auto|cuda|cpu`), model paths (local Windows paths), max concurrent requests, request/response size limits, log level, and metrics port.
- **Resource controls:**
  - Input image downscaling to `max_size` while preserving aspect ratio.
  - Concurrency limits per worker; queue size with 429 on overflow.
  - Memory ceiling with graceful rejection if estimated usage exceeds threshold.
- **Security:**
  - Bind to internal interfaces by default.
  - Token-based auth or mTLS; configurable allowed origins for CORS.
  - Size/type validation on uploads; audit logging with request IDs.
- **Observability:** structured logs with request IDs, timing, device info; Prometheus metrics (`latency`, `errors`, `gpu_mem_usage`).
- **Deployment:**
  - Primary target: Windows services or scheduled tasks (e.g., `nssm` + `uvicorn` or a packaged `pyinstaller` binary) listening on a LAN-only interface.
  - Windows-friendly Docker option when customers use Docker Desktop; include CUDA and CPU variants.
  - Warmup on startup; optional multi-worker scaling by running multiple service instances behind a Windows load balancer/reverse proxy (IIS/HTTP.SYS/NGINX on Windows).

### Windows-specific guidance
- **Paths and permissions:** ensure model weights reside on fast local storage with paths like `C:\controlnet\models`; avoid UNC paths for performance-critical reads.
- **GPU drivers:** require current NVIDIA Windows drivers with CUDA toolkit matching packaged Torch builds; include a `driver_check.ps1` snippet to confirm `nvidia-smi.exe` works.
- **Service accounts:** run the worker under a dedicated Windows account with minimal privileges; allow `Lock pages in memory` if large model pinning is needed.
- **Firewall:** open only the chosen HTTP port to the internal network; restrict scope to the corporate subnet.

### Data flow
1. Client uploads an image via `POST /preprocess/{type}`.
2. Server validates request, downsizes if needed, selects device, and runs the preprocessor.
3. Server returns conditioning map + metadata; client continues downstream ControlNet inference.

### Failure handling
- Return structured errors with codes (`invalid_image`, `model_unavailable`, `timeout`, `resource_limit`).
- Retryable errors tagged for client-side exponential backoff.
- Fallback to CPU mode when GPU unavailable (if enabled); otherwise return clear diagnostic.

## 3. Tests to Verify Capabilities and Functionality

### Capability probe tests (CLI)
- **Unit:** mock `torch` device queries and ensure JSON report includes hardware fields and thresholds.
- **Integration:** run `tools/probe_capabilities.py` on Windows hosts without GPU and with GPU (CI matrix if available) to ensure graceful fallback.
- **Performance thresholds:** assert probe marks status `pass` when latency/memory under limits and `warn/fail` otherwise using synthetic metrics.

### API and functional tests
- **Endpoint contract:** (executed from Windows desktop clients)
  - `POST /preprocess/depth` with a 512×512 fixture image returns 200, correct `type`, non-empty PNG payload, and latency metadata present.
  - Invalid images or oversize payloads yield 400 with `invalid_image`.
  - Unloaded/disabled preprocessors return 503 `model_unavailable`.
- **Device selection:**
  - With GPU available, response includes `device="cuda"`; with CPU-only flag, `device="cpu"`.
- **Concurrency and limits:**
  - Flood test (e.g., 50 concurrent small requests) respects queue/concurrency caps and returns 429 when saturated.
- **Security:**
  - Auth token missing returns 401 when enabled; CORS headers follow config.

### Performance/load tests
- **Latency budgets:** measure P50/P95 latency for depth at 512×512 and 768×768; assert against configurable thresholds.
- **Resource usage:** capture peak GPU/CPU memory during sustained load (e.g., 5 minutes at configured QPS); ensure under ceilings. On Windows, collect GPU stats via `nvidia-smi.exe --query-gpu=memory.used --format=csv` and RAM via PowerShell (`Get-Counter "\Memory\Available MBytes"`).
- **Stability:** run soak test (e.g., 1 hour low QPS) on Windows hosts to verify no memory leaks and consistent readiness.

### Regression tests
- Snapshot tests for generated maps (hash/SSIM tolerance) to catch model drift after updates.
- Backward compatibility tests for API schema (e.g., via OpenAPI contract tests) to ensure client SDKs remain compatible.

### Test tooling
- Use `pytest` + `httpx`/`requests` for API tests; `pytest-benchmark` for performance microbenchmarks; `locust` or `k6` for load tests; `pytest-snapshot` or SSIM-based comparators for map outputs.
- CI jobs should cache models and run GPU jobs when available; CPU-only fallback path in CI to validate logic when GPUs are absent.

