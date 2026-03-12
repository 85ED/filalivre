# TEST 2: Railway Container Validation
# Deploy validation Dockerfile to Railway using Docker instead of Nixpacks

## Overview

This test deploys the same Dockerfile.validation to Railway as a Docker image,
confirming that the system dependencies fix works in production.

**Timeline:** 10-15 minutes (depends on Railway build time)

---

## Prerequisites

1. Railway CLI installed and authenticated
2. Access to filalivre-production project
3. Dockerfile.validation exists in backend/

Verify:
```bash
railway auth login
railway project select filalivre-production
```

---

## Option A: Via Railway Dashboard (RECOMMENDED - No CLI needed)

### Step 1: Access Railway Dashboard

1. Go to: https://railway.app/project/filalivre-production
2. Select the `filalivre-whatsapp` service
3. Click on "Settings"

### Step 2: Configure Docker Build

1. Look for "Build" section
2. Select "Docker" (instead of "Nixpacks")
3. For "Dockerfile path", enter: `backend/Dockerfile.validation`
4. Save settings

### Step 3: Trigger Deploy

1. Click "Trigger Deploy" or "Deploy"
2. Watch the build logs (should take 2-3 minutes)

### Step 4: Check Status

Once deployed, you should see:
- Service status: "Active" (green)
- Build log should show: "Successfully built docker image"

### Step 5: Test Endpoints (See Below)

---

## Option B: Via Railway CLI

### Step 1: Set Up Docker Build Configuration

```bash
cd /Users/edsonfelix/Documents/Freelas/filalivre

# Make sure you're in the right project
railroad project select filalivre-production

# Configure to use Docker
railway service select filalivre-whatsapp

# Set the Dockerfile path
railway env set RAILWAY_DOCKERFILE_PATH backend/Dockerfile.validation
```

### Step 2: Trigger Deployment

```bash
# Deploy and watch logs
railway up --detach

# Or deploy specific service
railway deploy --service filalivre-whatsapp
```

### Step 3: Watch Build

```bash
# View live logs during build and after
railway logs filalivre-whatsapp --follow

# Stop watching: Ctrl+C
```

---

## Testing Endpoints After Deployment

### Test 1: /ping endpoint

```bash
# Live URL (replace with your actual Railway domain)
curl -v https://filalivre-production.up.railway.app/api/whatsapp/ping

# Expected: 200 OK with "pong"
```

### Test 2: /health endpoint

```bash
curl -v https://filalivre-production.up.railway.app/api/whatsapp/health

# Expected: 200 OK with JSON
# {"service":"filalivre-whatsapp","status":"ok","timestamp":"..."}
```

### Test 3: /ready endpoint

```bash
curl -v https://filalivre-production.up.railway.app/api/whatsapp/ready

# Expected: 200 OK with JSON
# {"service":"filalivre-whatsapp","status":"ready","port":3003,...}
```

### Test 4: Diagnostic endpoint (comprehensive test)

```bash
curl -v https://filalivre-production.up.railway.app/api/whatsapp-diagnostic

# Expected: 200 OK with all endpoints test results
```

---

## Success Criteria

### ✅ If ALL endpoints respond with 200:

```
✓ /ping → "pong" (200)
✓ /health → JSON (200)
✓ /ready → JSON (200)
✓ /api/whatsapp-diagnostic → test results (200)
```

**CONCLUSION:** System dependencies were definitely the cause. Docker fix is confirmed.

### ❌ If endpoints still fail:

Check Railway logs:

```bash
# View logs that might show errors
railway logs filalivre-whatsapp --tail 50 | grep -E "error|failed|libgtk|chromium"
```

**Possible issues:**
- Environment variables not set properly
- Database connectivity (but /ping should still work)
- Different root cause

---

## Important Notes

1. **Do NOT modify code** - This is just testing environment setup
2. **Docker image uses same code** - Only difference is system dependencies
3. **Reversible** - Can always revert to Nixpacks if needed
4. **Check logs** - Any errors will show in Railway dashboard logs

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "Dockerfile not found" | Verify path is `backend/Dockerfile.validation` |
| Build fails | Check backend/.env exists and has required vars |
| Build succeeds but /ping fails | Check Railway logs for runtime errors |
| Service won't start | Verify PORT and WHATSAPP_PORT env vars set |

---

## After Successful Validation

If TEST 2 passes (all endpoints respond):

1. Document results
2. Confidence level: 95%+ that Docker solves the issue
3. Ready to implement full Docker solution for all 3 services
4. Timeline for full implementation: 3-4 hours

---

## Manual Test Commands (Copy-Paste Ready)

Assuming Railway domain is: `https://filalivre-production.up.railway.app`

```bash
# Test batch - run all at once
echo "Testing /ping..."
curl -s -o /dev/null -w "ping: %{http_code}\n" https://filalivre-production.up.railway.app/api/whatsapp/ping

echo "Testing /health..."
curl -s -o /dev/null -w "health: %{http_code}\n" https://filalivre-production.up.railway.app/api/whatsapp/health

echo "Testing /ready..."
curl -s -o /dev/null -w "ready: %{http_code}\n" https://filalivre-production.up.railway.app/api/whatsapp/ready

echo "Testing /diagnostic..."
curl -s https://filalivre-production.up.railway.app/api/whatsapp-diagnostic | jq '.' || echo "Failed"
```

---

## Full Results Template (Copy and document after testing)

```
╔════════════════════════════════════════════════════════════╗
║          TEST 2: RAILWAY DOCKER VALIDATION                 ║
╚════════════════════════════════════════════════════════════╝

Date: [today's date]
Railway Domain: [your domain]
Dockerfile: backend/Dockerfile.validation

ENDPOINTS TEST RESULTS:
══════════════════════════════════════════════════════════════

1. /ping endpoint
   URL: https://[domain]/api/whatsapp/ping
   Response Code: [___]
   Response Body: [___________]
   Status: [ ] PASS  [ ] FAIL

2. /health endpoint
   URL: https://[domain]/api/whatsapp/health
   Response Code: [___]
   Response Body: [___________]
   Status: [ ] PASS  [ ] FAIL

3. /ready endpoint
   URL: https://[domain]/api/whatsapp/ready
   Response Code: [___]
   Response Body: [___________]
   Status: [ ] PASS  [ ] FAIL

4. /diagnostic endpoint
   URL: https://[domain]/api/whatsapp-diagnostic
   Response Code: [___]
   All tests passing: [ ] YES  [ ] NO
   Status: [ ] PASS  [ ] FAIL

══════════════════════════════════════════════════════════════

CONCLUSION:
───────────
[ ] CONFIRMED: System dependencies were the cause
[ ] PARTIAL: Some endpoints work, others don't
[ ] FAILED: Problem is different than expected

NEXT ACTION:
────────────
[ ] Proceed with full Docker implementation
[ ] Investigate additional issues
[ ] Revert to Nixpacks and investigate further
```

---

**TEST 2 Execution Time: 10-15 minutes (includes Railway build)**

Once TEST 2 passes, implementation confidence is >95%.
