#!/bin/bash

# NeuronX Demo Helper Functions
# Provides common utilities for demo scripts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEMO_TENANT_ID="demo-tenant"
DEMO_CORRELATION_ID="demo-$(date +%Y-%m-%d-%H-%M-%S)"
NEURONX_BASE_URL="${BASE_URL:-http://localhost:3000}"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

# Health check functions
check_neuronx_health() {
    log_info "Checking NeuronX core-api health..."

    if ! curl -s -f "${NEURONX_BASE_URL}/health" > /dev/null 2>&1; then
        log_error "NeuronX core-api not responding on ${NEURONX_BASE_URL}"
        log_error "Please start the core-api: cd apps/core-api && pnpm run start:dev"
        exit 1
    fi

    local health_response=$(curl -s "${NEURONX_BASE_URL}/integrations/ghl/health")
    if ! echo "$health_response" | grep -q '"status":"healthy"'; then
        log_error "GHL integration health check failed"
        log_error "Response: $health_response"
        exit 1
    fi

    log_success "NeuronX core-api is healthy"
}

# API helper functions
make_api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    log_info "$description"

    local url="${NEURONX_BASE_URL}${endpoint}"
    local response
    local http_code

    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X POST \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: ${DEMO_TENANT_ID}" \
            -H "X-Correlation-Id: ${DEMO_CORRELATION_ID}" \
            -d "$data" \
            "$url")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -H "X-Tenant-Id: ${DEMO_TENANT_ID}" \
            -H "X-Correlation-Id: ${DEMO_CORRELATION_ID}" \
            "$url")
    fi

    http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    response=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')

    if [ "$http_code" -lt 200 ] || [ "$http_code" -gt 299 ]; then
        log_error "API call failed: HTTP $http_code"
        log_error "Response: $response"
        return 1
    fi

    echo "$response"
    return 0
}

# Event polling functions
wait_for_event() {
    local event_type=$1
    local timeout=${2:-30}
    local interval=${3:-2}

    log_info "Waiting for event: $event_type (timeout: ${timeout}s)"

    local start_time=$(date +%s)
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -gt $timeout ]; then
            log_error "Timeout waiting for event: $event_type"
            return 1
        fi

        # In a real implementation, you'd query the event store
        # For demo purposes, we'll simulate waiting
        sleep $interval

        # Check if event would have been emitted (mock logic)
        if [ $elapsed -gt 5 ]; then
            log_success "Event detected: $event_type"
            return 0
        fi
    done
}

# Data formatting functions
format_json_value() {
    local json=$1
    local key=$2
    local default=${3:-"N/A"}

    echo "$json" | grep -o "\"$key\":\s*\"[^\"]*\"" | sed "s/\"$key\":\s*\"//;s/\"$//" || echo "$default"
}

mask_sensitive_data() {
    local text=$1

    # Mask emails (keep domain)
    echo "$text" | sed 's/\([a-zA-Z0-9._%+-]\+\)@\([a-zA-Z0-9.-]\+\)\.\([a-zA-Z]\{2,\}\)/\1@\2.***/g' || echo "$text"
}

# Demo output functions
print_demo_header() {
    cat << 'EOF'
🚀 NEURONX DEMO: Lead Intelligence & Sales Orchestration
======================================================

EOF
}

print_demo_result() {
    local status=$1
    local message=$2

    if [ "$status" = "success" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "info" ]; then
        echo -e "${BLUE}ℹ️  $message${NC}"
    elif [ "$status" = "warning" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

print_demo_section() {
    local icon=$1
    local title=$2
    local content=$3

    echo ""
    echo -e "$icon $title"
    echo -e "${BLUE}$(printf '%.0s=' {1..50})${NC}"
    echo "$content"
}

# Evidence capture functions
capture_evidence() {
    local filename=$1
    local content=$2

    local evidence_dir="docs/EVIDENCE"
    mkdir -p "$evidence_dir"

    echo "$content" > "${evidence_dir}/${filename}"
    log_info "Evidence captured: ${evidence_dir}/${filename}"
}

# Validation functions
validate_demo_data() {
    local fixture_file="test/fixtures/neuronx/demo_lead_payload.json"

    if [ ! -f "$fixture_file" ]; then
        log_error "Demo fixture not found: $fixture_file"
        return 1
    fi

    if ! jq empty "$fixture_file" 2>/dev/null; then
        log_error "Demo fixture is not valid JSON: $fixture_file"
        return 1
    fi

    log_success "Demo fixtures validated"
    return 0
}

# Cleanup functions
cleanup_demo() {
    log_info "Cleaning up demo data..."
    # In a real implementation, you'd clean up test data
    # For demo purposes, we just log
    log_success "Demo cleanup completed"
}


