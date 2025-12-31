# Analytics & Listening Tracking System Design

## Overview

This document outlines the design for comprehensive listening analytics in the Groovo admin panel, tracking user behavior, play counts, and listening patterns.

## Data Model

### Listening History Collection (`listening_history`)

```python
{
  "_id": ObjectId,
  "user_email": "user@example.com",
  "song": {
    "url": "https://youtube.com/watch?v=...",
    "title": "Song Title",
    "artist": "Artist Name", 
    "thumbnail": "thumbnail_url",
    "duration": "3:45"
  },
  "timestamp": ISODate("2024-12-31T15:30:00Z"),
  "session_id": "unique_session_id",
  "event_type": "play" | "pause" | "skip" | "complete",
  "listen_duration": 125,  // seconds actually listened
  "device_info": {
    "platform": "desktop",
    "app_version": "1.0.0"
  }
}
```

### Currently Listening Collection (`current_sessions`)

```python
{
  "_id": ObjectId,
  "user_email": "user@example.com",
  "song": {
    "url": "https://youtube.com/watch?v=...",
    "title": "Song Title",
    "artist": "Artist Name",
    "thumbnail": "thumbnail_url"
  },
  "started_at": ISODate("2024-12-31T15:30:00Z"),
  "last_updated": ISODate("2024-12-31T15:31:00Z"),
  "status": "playing" | "paused"
}
```

## API Endpoints

### Main App (Groovo) - Tracking Endpoints

1. **POST /api/track/play**
   - Records when a song starts playing
   - Creates entry in listening_history
   - Updates current_sessions

2. **POST /api/track/pause**
   - Records pause event
   - Updates current_sessions status

3. **POST /api/track/complete**
   - Records song completion
   - Removes from current_sessions

4. **POST /api/track/skip**
   - Records skip event
   - Updates listening_history with actual duration

### Admin Panel - Analytics Endpoints

1. **GET /api/analytics/overview**
   - Total plays across all users
   - Unique listeners
   - Average listening time
   - Active users (last 24h, 7d, 30d)

2. **GET /api/analytics/top-songs**
   - Most played songs
   - Play count
   - Unique listeners
   - Average completion rate

3. **GET /api/analytics/listening-patterns**
   - Hourly breakdown (24h format)
   - Daily breakdown (7 days)
   - Peak listening times

4. **GET /api/analytics/currently-listening**
   - List of users currently playing songs
   - Real-time status
   - Current song info

5. **GET /api/analytics/user-activity/<email>**
   - Individual user's listening history
   - Top songs for that user
   - Listening habits

## Admin Dashboard Features

### 1. Real-Time Overview Panel
- **Currently Listening**: Live view of active users
- **Active Sessions**: Number of current playback sessions
- **Today's Plays**: Total plays in last 24 hours

### 2. Top Songs Charts
- **Most Played**: Songs with highest play count
- **Trending**: Songs gaining popularity
- **Completion Rate**: Songs most often played to completion

### 3. Time-Based Analytics
- **Hourly Heatmap**: Shows peak listening hours
- **Weekly Trends**: Day-by-day comparison
- **Time Zone Analysis**: Listening patterns by time of day

### 4. User Analytics
- **Most Active Users**: Users with highest play counts
- **Engagement Metrics**: Average session length per user
- **Library Usage**: % of library actually played

## Implementation Steps

### Phase 1: Backend Tracking (Main App)
1. Add listening_history and current_sessions collections
2. Create tracking middleware/functions
3. Add API endpoints to record play events
4. Integrate with existing player JavaScript

### Phase 2: Admin Analytics Backend
1. Add analytics API endpoints
2. Implement aggregation queries for statistics
3. Add real-time currently-listening endpoint

### Phase 3: Admin UI
1. Create analytics dashboard page
2. Add charts using Chart.js or similar
3. Build real-time currently-listening widget
4. Add filters and date range selectors

### Phase 4: Visualizations
1. Line charts for time-based trends
2. Bar charts for top songs
3. Pie charts for genre/category distribution
4. Heatmaps for hourly patterns

## Technology Stack

- **Charts**: Chart.js (lightweight and responsive)
- **Real-time Updates**: Polling every 10 seconds for currently-listening
- **Data Processing**: MongoDB aggregation pipeline
- **Caching**: Redis (optional) for frequently accessed analytics

## Privacy Considerations

- Listening history is admin-only
- No data sharing with third parties
- Users can request deletion of their history (compliance feature)
- Anonymized aggregate statistics

## Performance Optimization

- Index on `timestamp` and `user_email` fields
- Aggregation pipeline optimization
- Cache analytics results for 5 minutes
- Pagination for large datasets
