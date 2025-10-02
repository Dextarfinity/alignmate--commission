# Weekly Progress Aggregation System

This document explains how the weekly progress aggregation system works in the AlignMate application.

## Overview

The weekly progress aggregation system automatically collects scan data from the `scan_history` table and aggregates it into weekly summaries stored in the `weekly_progress` table. This provides efficient querying of historical progress data without repeatedly calculating statistics from raw scan data.

## How It Works

### 1. **Automatic Scheduling**
- **Trigger**: Runs when the Camera component mounts and when a user session is detected
- **Frequency**: Daily checks (every 24 hours) to see if aggregation is needed
- **Logic**: Uses localStorage to track the last aggregation run and only processes if we've entered a new week

### 2. **Week Calculation**
- **Week Start**: Monday at 00:00:00 (configurable)
- **Week End**: Sunday at 23:59:59
- **Time Zone**: Uses local browser timezone

### 3. **Aggregation Process**

#### Step 1: Historical Analysis
- Finds the earliest scan in `scan_history` for the user
- Calculates all weeks from first scan to current week
- Processes each week that has scan data

#### Step 2: Weekly Statistics Calculation
For each week, calculates:
- `total_scans`: Total number of scans performed
- `successful_scans`: Number of scans marked as successful
- `average_score`: Average posture score across all scans
- `week_start_date` and `week_end_date`: Date boundaries

#### Step 3: Database Updates
- Checks if a record already exists for that user/week combination
- **If exists**: Updates the existing record with latest statistics
- **If new**: Inserts a new weekly progress record
- Uses UPSERT logic to handle concurrent updates safely

### 4. **Data Flow**

```
scan_history (raw data) 
    ↓
aggregateAllWeeklyProgress() 
    ↓
weekly_progress (aggregated data)
    ↓
UI displays historical trends
```

## Key Functions

### `updateWeeklyProgress(userId)`
- Updates/inserts the current week's progress for a user
- Called after each scan to keep current week data fresh
- Handles both new records and updates to existing records

### `aggregateAllWeeklyProgress(userId)`
- Processes ALL historical weeks for a user
- Runs during first-time setup or when gaps are detected
- Ensures complete historical data is available

### `checkAndRunWeeklyAggregation(userId)`
- Smart scheduler that determines if aggregation is needed
- Tracks last run time using localStorage
- Only runs aggregation when entering a new week

## Database Schema

### weekly_progress table:
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- week_start_date: DATE (Monday of the week)
- week_end_date: DATE (Sunday of the week)
- total_scans: INTEGER (count of all scans)
- successful_scans: INTEGER (count of successful scans)
- average_score: DECIMAL(5,2) (average posture score)
- created_at: TIMESTAMP (when record was first created)
- updated_at: TIMESTAMP (when record was last modified)
```

### Unique Constraint:
- `(user_id, week_start_date)` ensures one record per user per week

## Benefits

1. **Performance**: Historical queries are fast (no complex aggregations)
2. **Scalability**: Works efficiently even with thousands of scans
3. **Reliability**: Handles missing weeks and data gaps automatically
4. **Flexibility**: Can be extended to monthly/yearly aggregations

## Manual Controls

### Debug Button (Development)
- Located in the Weekly Statistics UI section
- Button: "🔧 Force Weekly Aggregation (Debug)"
- Manually triggers full historical aggregation
- Useful for testing and data verification

### Monitoring
Check the browser console for these log messages:
- `🗓️ Checking if weekly aggregation is needed...`
- `📅 First time running weekly aggregation`
- `📅 New week detected, running weekly aggregation`
- `🔄 Starting weekly progress aggregation for user: [id]`
- `✅ Weekly progress updated/inserted successfully`
- `🎉 Weekly progress aggregation completed`

## Error Handling

The system handles various error conditions:
- Missing scan_history data
- Database connection issues
- Concurrent update conflicts
- Invalid date ranges
- Authentication failures

All errors are logged to console with descriptive messages.

## Configuration

### Timing Settings:
- **Daily Check Interval**: 24 hours (24 * 60 * 60 * 1000 ms)
- **Week Start Day**: Monday (day 1)
- **LocalStorage Key**: `weekly_aggregation_last_run_${userId}`

### Customization Options:
1. Change week start day by modifying the date calculation logic
2. Adjust check frequency by changing the setInterval duration  
3. Add monthly/yearly aggregations by extending the date range logic
4. Implement server-side cron jobs for more reliable scheduling

## Future Enhancements

1. **Server-Side Scheduling**: Move to backend cron jobs for reliability
2. **Batch Processing**: Handle multiple users simultaneously
3. **Data Validation**: Add checks for data consistency
4. **Notification System**: Alert users about progress milestones
5. **Export Features**: Allow users to download weekly progress reports

## Troubleshooting

### Common Issues:

1. **Aggregation Not Running**
   - Check browser console for error messages
   - Verify user authentication status
   - Check localStorage for last run timestamp

2. **Missing Weekly Data**
   - Use the manual debug button to force aggregation
   - Check scan_history table for data availability
   - Verify date range calculations

3. **Duplicate Records**
   - Database unique constraint prevents this
   - Check for timezone-related date calculation issues

4. **Performance Issues**
   - Monitor aggregation time for users with many scans
   - Consider implementing pagination for large datasets
   - Add database indexes for better query performance