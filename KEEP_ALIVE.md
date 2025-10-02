# 🎯 Supabase Keep-Alive System

This system prevents your Supabase free tier database from pausing due to inactivity by sending automated weekly queries.

## 🏗️ Available Options

### 1. GitHub Actions (Recommended)
Automatically runs weekly via GitHub Actions workflow.

**Setup:**
1. Add your Supabase credentials to GitHub Secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. The workflow runs every Sunday at 2:00 AM UTC
3. Can be manually triggered from GitHub Actions tab

**File:** `.github/workflows/keep-alive.yml`

### 2. Vercel Cron Jobs
Runs as a serverless function on Vercel.

**Setup:**
1. Deploy to Vercel with the included `vercel.json`
2. Vercel automatically sets up the cron job
3. Runs every Sunday at 2:00 AM UTC
4. Monitor at: `https://your-app.vercel.app/api/keep-alive`

**Files:** 
- `api/keep-alive.js`
- `vercel.json`

### 3. Local/Manual Execution
Run the script manually or set up your own scheduler.

**Usage:**
```bash
# Test the keep-alive script
npm run keep-alive:test

# Run keep-alive
npm run keep-alive
```

**File:** `scripts/keep-alive.js`

## 🔧 Environment Variables

The following environment variables are required:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📊 How It Works

1. **Health Check**: Verifies connection to Supabase
2. **Keep-Alive Query**: Performs a simple database query
3. **Fallback**: If primary query fails, tries a simpler auth check
4. **Logging**: Provides detailed status information
5. **Error Handling**: Graceful failure with proper error reporting

## 🎖️ Query Strategy

The script uses a lightweight approach:

1. **Primary**: `SELECT count FROM profiles LIMIT 1`
2. **Fallback**: `supabase.auth.getSession()`

These queries are minimal and won't impact your database quota.

## 📅 Schedule

- **Frequency**: Weekly (every Sunday)
- **Time**: 2:00 AM UTC
- **Duration**: ~10-30 seconds per execution

## 🚨 Troubleshooting

### GitHub Actions Not Running
- Check if repository secrets are set correctly
- Verify the workflow file is in `.github/workflows/`
- Manual trigger from Actions tab to test

### Vercel Cron Job Issues
- Ensure `vercel.json` is in project root
- Check Vercel dashboard for cron job status
- Verify environment variables in Vercel settings

### Local Script Errors
- Ensure environment variables are set
- Check network connectivity
- Verify Supabase credentials are valid

## 📈 Monitoring

### GitHub Actions
- View execution history in the "Actions" tab
- Check logs for detailed execution information
- Receive email notifications on failures (if configured)

### Vercel
- Monitor function execution in Vercel dashboard
- Access logs via Vercel CLI or dashboard
- Test endpoint: `GET /api/keep-alive`

### Manual Testing
```bash
# Test locally
npm run keep-alive:test

# Check output for success/failure messages
```

## 🎯 Military-Grade Reliability

This keep-alive system ensures your AlignMate tactical database stays operational 24/7, maintaining mission readiness for all posture scanning operations! 🫡

---

**Note**: This system is specifically designed for Supabase free tier limitations and will keep your database active without significant resource usage.