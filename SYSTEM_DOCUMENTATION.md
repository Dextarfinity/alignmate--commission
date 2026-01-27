# AlignMate CSU - Comprehensive System Documentation

## Table of Contents
1. [Conceptual Framework](#conceptual-framework)
2. [Agile Development Approach](#agile-development-approach)
3. [System Flowchart](#system-flowchart)
4. [Use Case Diagram](#use-case-diagram)
5. [Data Flow Diagrams (DFD)](#data-flow-diagrams-dfd)
6. [System Requirements](#system-requirements)
7. [Technology Stack](#technology-stack)
8. [Hardware & Software Requirements](#hardware--software-requirements)

---

## 1. Conceptual Framework

### Input-Process-Output (IPO) Model

#### **INPUT**
- **User Authentication Data**
  - Email/password credentials
  - OAuth tokens (if applicable)
  - User profile information

- **Video Stream Data**
  - Real-time camera feed (front/back camera)
  - Image frames (9:16 portrait mode)
  - Base64 encoded image data

- **Posture Configuration**
  - Selected posture type (Salutation, Marching, Attention)
  - User preferences and settings
  - Audio control settings

#### **PROCESS**
- **Authentication & Authorization**
  - User login/signup via Supabase Auth
  - Session management
  - Profile creation and updates

- **Pose Detection & Analysis**
  - Real-time video capture from device camera
  - Image preprocessing and normalization
  - AI model inference using YOLOv8 Pose (ONNX format)
  - 17-keypoint detection (custom dataset)
  - Posture scoring and evaluation
  - Confidence calculation

- **Data Management**
  - Scan result storage in Supabase PostgreSQL
  - Weekly progress aggregation
  - Historical data retrieval
  - Real-time score updates

- **User Feedback**
  - Audio feedback (success/error sounds)
  - Visual overlay (keypoints, scores, indicators)
  - Toast notifications
  - Loading states and progress indicators

#### **OUTPUT**
- **Real-time Detection Results**
  - Posture score (0-100%)
  - Confidence level
  - 17 keypoint coordinates
  - Visual keypoint overlay on video feed
  - Status indicator (Good/Adjust/Excellent)

- **Stored Data**
  - Scan history with timestamps
  - Posture type and scores
  - Success/failure status
  - Feedback messages
  - Weekly aggregated statistics

- **User Interface Elements**
  - Camera preview with overlays
  - Score display (real-time percentage)
  - Weekly progress summary
  - Scan history list
  - Navigation controls

---

## 2. Agile Development Approach

### Sprint Structure

#### **Sprint 1: Foundation Setup (Week 1-2)**
- User authentication system
- Database schema design
- Basic UI framework
- Camera access implementation

#### **Sprint 2: Core Detection (Week 3-4)**
- YOLOv8 pose model integration
- Local ONNX model loading
- Keypoint detection implementation
- Basic posture analysis

#### **Sprint 3: Real-time Processing (Week 5-6)**
- Live video processing
- Real-time scoring algorithm
- Keypoint visualization overlay
- Performance optimization

#### **Sprint 4: Data Management (Week 7-8)**
- Scan history storage
- Weekly progress aggregation
- Statistics calculation
- Data retrieval APIs

#### **Sprint 5: User Experience (Week 9-10)**
- Audio feedback system
- Loading states
- Error handling
- UI/UX refinements

#### **Sprint 6: Testing & Deployment (Week 11-12)**
- Unit testing
- Integration testing
- Performance testing
- Production deployment

### Agile Ceremonies
- **Daily Standups**: Progress updates, blockers discussion
- **Sprint Planning**: Feature prioritization, story point estimation
- **Sprint Review**: Demo to stakeholders
- **Sprint Retrospective**: Process improvement
- **Backlog Grooming**: Story refinement

---

## 3. System Flowchart

```
START
  │
  ├─→ User Opens Application
  │
  ├─→ Check Authentication Status
  │   ├─→ [Not Authenticated]
  │   │   ├─→ Display Landing Page
  │   │   ├─→ User Selects Login/Signup
  │   │   ├─→ Enter Credentials
  │   │   ├─→ Validate with Supabase Auth
  │   │   └─→ Create/Update User Profile
  │   │
  │   └─→ [Authenticated]
  │       └─→ Load User Data
  │
  ├─→ Display Home Dashboard
  │   ├─→ Show Recent Scans
  │   ├─→ Show Weekly Statistics
  │   └─→ Navigation Options
  │
  ├─→ User Navigates to Camera Scanner
  │   │
  │   ├─→ Request Camera Permission
  │   │   ├─→ [Denied] → Show Error Message
  │   │   └─→ [Granted] → Initialize Camera
  │   │
  │   ├─→ Detect Available Cameras
  │   │   ├─→ Front Camera
  │   │   └─→ Back Camera (if available)
  │   │
  │   ├─→ Display Video Stream
  │   │
  │   ├─→ User Selects Posture Type
  │   │   ├─→ Salutation
  │   │   ├─→ Marching
  │   │   └─→ Attention
  │   │
  │   ├─→ User Starts Real-time Detection
  │   │   │
  │   │   ├─→ Capture Video Frame
  │   │   ├─→ Convert to Base64 Image
  │   │   ├─→ Load ONNX Model (if not loaded)
  │   │   ├─→ Preprocess Image
  │   │   │   ├─→ Resize to 640x640
  │   │   │   ├─→ Normalize to [0,1]
  │   │   │   └─→ Convert to CHW format
  │   │   │
  │   │   ├─→ Run Model Inference
  │   │   │   ├─→ YOLOv8 Pose Detection
  │   │   │   ├─→ Extract 17 Keypoints
  │   │   │   └─→ Calculate Confidence
  │   │   │
  │   │   ├─→ Analyze Posture
  │   │   │   ├─→ Calculate Posture Score
  │   │   │   ├─→ Generate Feedback
  │   │   │   └─→ Determine Status
  │   │   │
  │   │   ├─→ Draw Keypoints Overlay
  │   │   │   ├─→ Map to Canvas Coordinates
  │   │   │   └─→ Render Colored Dots
  │   │   │
  │   │   ├─→ Display Real-time Score
  │   │   │
  │   │   ├─→ Check Auto-save Conditions
  │   │   │   ├─→ Score >= 75%
  │   │   │   ├─→ Confidence > 0.6
  │   │   │   └─→ 3 seconds elapsed
  │   │   │
  │   │   ├─→ [Conditions Met]
  │   │   │   ├─→ Save to Database
  │   │   │   ├─→ Play Success Sound
  │   │   │   └─→ Show Toast Notification
  │   │   │
  │   │   └─→ Loop (Continue Detection)
  │   │
  │   └─→ User Stops Detection
  │       ├─→ Clear Canvas
  │       ├─→ Reset States
  │       └─→ Return to Camera View
  │
  ├─→ View Scan History
  │   ├─→ Fetch from Database
  │   ├─→ Filter by Date/Type
  │   └─→ Display List
  │
  ├─→ View Weekly Progress
  │   ├─→ Calculate Aggregations
  │   ├─→ Display Statistics
  │   └─→ Show Trends
  │
  ├─→ Update Settings
  │   ├─→ Audio Controls
  │   ├─→ Profile Information
  │   └─→ Save Preferences
  │
  └─→ Logout
      ├─→ Clear Session
      ├─→ Redirect to Landing
      └─→ END
```

---

## 4. Use Case Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AlignMate CSU System                      │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │                                                    │       │
│  │  ┌─────────────────────────────────────┐         │       │
│  │  │   Authentication Use Cases          │         │       │
│  │  │  - Register Account                 │◄────────┼───────┤ User
│  │  │  - Login to System                  │         │       │ (Student/
│  │  │  - Logout from System               │         │       │  Trainee)
│  │  │  - Reset Password                   │         │       │
│  │  └─────────────────────────────────────┘         │       │
│  │                                                    │       │
│  │  ┌─────────────────────────────────────┐         │       │
│  │  │   Camera & Detection Use Cases      │         │       │
│  │  │  - Access Camera                    │◄────────┼───────┤
│  │  │  - Select Posture Type              │         │       │
│  │  │  - Start Real-time Detection        │         │       │
│  │  │  - Stop Detection                   │         │       │
│  │  │  - Switch Camera (Front/Back)       │         │       │
│  │  │  - View Live Keypoints              │         │       │
│  │  │  - See Real-time Score              │         │       │
│  │  └─────────────────────────────────────┘         │       │
│  │                                                    │       │
│  │  ┌─────────────────────────────────────┐         │       │
│  │  │   Data Management Use Cases         │         │       │
│  │  │  - View Scan History                │◄────────┼───────┤
│  │  │  - View Weekly Progress             │         │       │
│  │  │  - Filter Scan Results              │         │       │
│  │  │  - View Statistics                  │         │       │
│  │  └─────────────────────────────────────┘         │       │
│  │                                                    │       │
│  │  ┌─────────────────────────────────────┐         │       │
│  │  │   Settings & Profile Use Cases      │         │       │
│  │  │  - Update Profile Information       │◄────────┼───────┤
│  │  │  - Manage Audio Settings            │         │       │
│  │  │  - Change Avatar                    │         │       │
│  │  └─────────────────────────────────────┘         │       │
│  │                                                    │       │
│  └──────────────────────────────────────────────────┘       │
│                                                               │
│  External Systems:                                           │
│  ┌──────────────────┐                                        │
│  │ Supabase Auth    │◄───────── Authentication              │
│  │ Service          │                                        │
│  └──────────────────┘                                        │
│                                                               │
│  ┌──────────────────┐                                        │
│  │ PostgreSQL DB    │◄───────── Data Storage                │
│  │ (Supabase)       │                                        │
│  └──────────────────┘                                        │
│                                                               │
│  ┌──────────────────┐                                        │
│  │ YOLOv8 ONNX      │◄───────── Pose Detection              │
│  │ Model            │                                        │
│  └──────────────────┘                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow Diagrams (DFD)

### Level 0 - Context Diagram

```
┌─────────────┐
│             │
│    User     │
│  (Student)  │
│             │
└──────┬──────┘
       │
       │ Login Credentials
       │ Posture Selection
       │ Camera Images
       │
       ▼
┌─────────────────────────────────┐
│                                 │
│     AlignMate CSU System        │
│   (Posture Detection System)    │
│                                 │
└──────┬──────────────────┬───────┘
       │                  │
       │ Detection Results│
       │ Scores & Feedback│
       │ Progress Reports │
       │                  │
       ▼                  │
┌──────────────┐          │
│              │          │
│     User     │          │
│              │          │
└──────────────┘          │
                          │
                          ▼
                   ┌──────────────┐
                   │  Supabase    │
                   │  Database    │
                   └──────────────┘
```

### Level 1 - Major Processes

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       │ 1.1 Credentials
       ▼
┌─────────────────────┐         ┌──────────────────┐
│  1.0                │  1.2    │   D1: Users      │
│  Authentication     ├────────►│   Database       │
│  Management         │  Store  │                  │
└──────┬──────────────┘         └──────────────────┘
       │ 1.3 Auth Token
       │
       │ 2.1 Video Stream
       ▼
┌─────────────────────┐
│  2.0                │         ┌──────────────────┐
│  Camera & Video     │  2.2    │   D2: Models     │
│  Processing         ├────────►│   (ONNX)         │
└──────┬──────────────┘  Load   └──────────────────┘
       │ 2.3 Frames
       │
       │ 3.1 Image Data
       ▼
┌─────────────────────┐         ┌──────────────────┐
│  3.0                │  3.2    │   D3: Keypoints  │
│  Pose Detection     ├────────►│   Configuration  │
│  & Analysis         │  Fetch  │                  │
└──────┬──────────────┘         └──────────────────┘
       │ 3.3 Keypoints & Score
       │
       │ 4.1 Results
       ▼
┌─────────────────────┐         ┌──────────────────┐
│  4.0                │  4.2    │   D4: Scan       │
│  Data Storage &     ├────────►│   History        │
│  Management         │  Store  │                  │
└──────┬──────────────┘         └──────────────────┘
       │                        ┌──────────────────┐
       │                 4.3    │   D5: Weekly     │
       │               ┌───────►│   Progress       │
       │               │Store   │                  │
       │               │        └──────────────────┘
       │ 4.4 Statistics
       │
       │ 5.1 Display Data
       ▼
┌─────────────────────┐
│  5.0                │
│  User Interface     │
│  & Feedback         │
└──────┬──────────────┘
       │ 5.2 Results
       ▼
┌─────────────┐
│    User     │
└─────────────┘
```

### Level 2 - Detailed Process: Pose Detection & Analysis (Process 3.0)

```
                    ┌──────────────────┐
                    │  D2: ONNX Model  │
                    └────────┬─────────┘
                             │ 3.1.2 Model
                             ▼
  3.1 Image       ┌───────────────────┐
  Data from       │  3.1               │
  Camera  ───────►│  Load & Initialize│
                  │  AI Model          │
                  └──────┬────────────┘
                         │ 3.1.3 Ready Model
                         ▼
  3.2 Frame       ┌───────────────────┐
  Data    ───────►│  3.2               │
                  │  Image             │
                  │  Preprocessing     │
                  └──────┬────────────┘
                         │ 3.2.1 Processed Image
                         ▼
                  ┌───────────────────┐         ┌──────────────────┐
                  │  3.3               │  3.3.1  │  D3: Keypoint    │
                  │  Keypoint          ├────────►│  Configuration   │
                  │  Detection         │  Fetch  │                  │
                  └──────┬────────────┘         └──────────────────┘
                         │ 3.3.2 Raw Keypoints
                         ▼
                  ┌───────────────────┐
                  │  3.4               │
                  │  Coordinate        │
                  │  Mapping           │
                  └──────┬────────────┘
                         │ 3.4.1 Mapped Keypoints
                         ▼
                  ┌───────────────────┐
  3.5.1 Posture   │  3.5               │
  Type    ───────►│  Posture Score     │
                  │  Calculation       │
                  └──────┬────────────┘
                         │ 3.5.2 Score & Confidence
                         ▼
                  ┌───────────────────┐
                  │  3.6               │
                  │  Feedback          │
                  │  Generation        │
                  └──────┬────────────┘
                         │
                         │ 3.6.1 Results
                         ▼
                    To Process 4.0
                    (Data Storage)
```

---

## 6. System Requirements

### 6.1 Functional Requirements

#### FR1: User Authentication
- **FR1.1**: System shall allow users to register with email and password
- **FR1.2**: System shall authenticate users via Supabase Auth
- **FR1.3**: System shall maintain user sessions
- **FR1.4**: System shall allow users to logout
- **FR1.5**: System shall automatically create user profiles on registration

#### FR2: Camera Management
- **FR2.1**: System shall request camera permissions from the browser
- **FR2.2**: System shall detect available cameras (front/back)
- **FR2.3**: System shall allow users to switch between cameras
- **FR2.4**: System shall display real-time video feed in 9:16 portrait mode
- **FR2.5**: System shall handle camera errors gracefully

#### FR3: Posture Detection
- **FR3.1**: System shall load YOLOv8 pose detection model (ONNX format)
- **FR3.2**: System shall detect 17 keypoints from video frames
- **FR3.3**: System shall support three posture types: Salutation, Marching, Attention
- **FR3.4**: System shall calculate posture scores (0-100%)
- **FR3.5**: System shall calculate confidence levels for detections
- **FR3.6**: System shall process frames at approximately 2 FPS

#### FR4: Real-time Processing
- **FR4.1**: System shall display live keypoint overlays on video feed
- **FR4.2**: System shall show real-time posture scores
- **FR4.3**: System shall provide visual status indicators (Good/Adjust/Excellent)
- **FR4.4**: System shall auto-save good postures (score >= 75%, confidence > 0.6)
- **FR4.5**: System shall enforce 3-second minimum between auto-saves

#### FR5: Data Storage
- **FR5.1**: System shall store scan results in PostgreSQL database
- **FR5.2**: System shall record timestamps for all scans
- **FR5.3**: System shall save posture type, score, and feedback
- **FR5.4**: System shall maintain scan history per user
- **FR5.5**: System shall aggregate weekly statistics

#### FR6: Progress Tracking
- **FR6.1**: System shall calculate total scans per week
- **FR6.2**: System shall count successful scans (score >= 75%)
- **FR6.3**: System shall calculate average scores
- **FR6.4**: System shall display weekly progress summaries
- **FR6.5**: System shall show recent scan history

#### FR7: User Interface
- **FR7.1**: System shall provide responsive mobile-first interface
- **FR7.2**: System shall display posture selection dropdown
- **FR7.3**: System shall show loading indicators during processing
- **FR7.4**: System shall provide audio feedback for events
- **FR7.5**: System shall display toast notifications for actions

#### FR8: Settings Management
- **FR8.1**: System shall allow users to update profile information
- **FR8.2**: System shall allow audio control (enable/disable)
- **FR8.3**: System shall persist user preferences
- **FR8.4**: System shall allow avatar uploads

### 6.2 Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: System shall load within 3 seconds on 4G connection
- **NFR1.2**: Real-time detection shall maintain 2 FPS minimum
- **NFR1.3**: Database queries shall complete within 500ms
- **NFR1.4**: ONNX model inference shall complete within 500ms per frame
- **NFR1.5**: System shall support concurrent users without degradation

#### NFR2: Usability
- **NFR2.1**: System shall be intuitive with minimal learning curve
- **NFR2.2**: Interface shall follow mobile-first design principles
- **NFR2.3**: System shall provide clear error messages
- **NFR2.4**: Visual feedback shall be immediate (< 100ms)
- **NFR2.5**: System shall be accessible (WCAG 2.1 Level AA)

#### NFR3: Reliability
- **NFR3.1**: System shall have 99.5% uptime
- **NFR3.2**: System shall handle network interruptions gracefully
- **NFR3.3**: System shall recover from model loading failures
- **NFR3.4**: Data integrity shall be maintained during concurrent operations
- **NFR3.5**: System shall implement automatic error logging

#### NFR4: Security
- **NFR4.1**: All authentication shall use HTTPS/TLS 1.3
- **NFR4.2**: Passwords shall be hashed using bcrypt
- **NFR4.3**: Session tokens shall expire after 24 hours
- **NFR4.4**: Database shall implement Row Level Security (RLS)
- **NFR4.5**: User data shall be isolated per account
- **NFR4.6**: API requests shall include authentication tokens

#### NFR5: Scalability
- **NFR5.1**: System shall support 1000+ concurrent users
- **NFR5.2**: Database shall handle 10,000+ scan records per user
- **NFR5.3**: System shall scale horizontally via serverless functions
- **NFR5.4**: Storage shall support unlimited user growth
- **NFR5.5**: CDN shall cache static assets globally

#### NFR6: Maintainability
- **NFR6.1**: Code shall follow TypeScript strict mode
- **NFR6.2**: System shall use modular architecture
- **NFR6.3**: Components shall be reusable and testable
- **NFR6.4**: Documentation shall be comprehensive
- **NFR6.5**: Version control shall use Git with semantic versioning

#### NFR7: Compatibility
- **NFR7.1**: System shall support Chrome 90+, Firefox 88+, Safari 14+
- **NFR7.2**: System shall work on iOS 14+ and Android 10+
- **NFR7.3**: System shall support screen sizes 320px - 1920px width
- **NFR7.4**: System shall support both portrait and landscape orientations
- **NFR7.5**: System shall function offline for model inference

#### NFR8: Privacy
- **NFR8.1**: Video data shall not be stored permanently
- **NFR8.2**: Image processing shall occur locally in browser
- **NFR8.3**: Only scores and metadata shall be transmitted to server
- **NFR8.4**: Users shall control their data (view, export, delete)
- **NFR8.5**: System shall comply with data protection regulations

---

## 7. Technology Stack

### 7.1 Frontend Development

#### **Core Framework**
- **React 18.3.1**
  - Component-based architecture
  - Hooks for state management
  - Virtual DOM for performance
  - JSX for declarative UI

#### **Language**
- **TypeScript 5.5.3**
  - Static typing
  - Enhanced IDE support
  - Better code maintainability
  - Compile-time error checking

#### **Build Tool**
- **Vite 5.4.2**
  - Fast hot module replacement (HMR)
  - Optimized production builds
  - ES modules support
  - Plugin ecosystem

#### **UI Framework**
- **Tailwind CSS 3.4.10**
  - Utility-first CSS framework
  - Responsive design utilities
  - Custom color palette
  - Dark mode support

#### **Routing**
- **React Router DOM 6.26.1**
  - Client-side routing
  - Lazy loading
  - Protected routes
  - Navigation guards

#### **State Management**
- **React Context API**
  - AuthContext for authentication
  - LoadingContext for loading states
  - AudioContext for sound management
  - Custom hooks for data fetching

#### **AI/ML Libraries**
- **ONNX Runtime Web 1.19.2**
  - YOLOv8 pose model execution
  - WebAssembly backend
  - Browser-based inference
  - GPU acceleration support

#### **Media Handling**
- **Browser MediaDevices API**
  - Camera access
  - Video streaming
  - Canvas rendering
  - Image capture

#### **Notifications**
- **React Hot Toast 2.4.1**
  - Toast notifications
  - Success/error messages
  - Customizable styling

#### **Mobile Framework**
- **Capacitor 6.1.2**
  - Native mobile app packaging
  - Camera API
  - File system access
  - Native device features

### 7.2 Backend Development

#### **Backend-as-a-Service (BaaS)**
- **Supabase 2.45.3**
  - PostgreSQL database
  - Authentication service
  - Real-time subscriptions
  - Row Level Security (RLS)
  - RESTful API auto-generation
  - Storage buckets

#### **Authentication**
- **Supabase Auth**
  - Email/password authentication
  - JWT token management
  - Session handling
  - Password reset
  - User metadata

#### **API Architecture**
- **RESTful API**
  - Auto-generated from database schema
  - CRUD operations
  - Query filtering
  - Pagination support

#### **Serverless Functions**
- **Vercel Serverless Functions**
  - API endpoints
  - Background jobs
  - Scheduled tasks (keep-alive)

#### **File Storage**
- **Supabase Storage**
  - Avatar uploads
  - Model files (ONNX)
  - Asset management

### 7.3 Database Management

#### **Database System**
- **PostgreSQL 15+** (via Supabase)
  - Relational database
  - ACID compliance
  - JSON support
  - Full-text search
  - Triggers and functions

#### **Database Schema**

**Tables:**
1. **profiles**
   - id (UUID, Primary Key, Foreign Key → auth.users)
   - username (TEXT, UNIQUE)
   - full_name (TEXT)
   - avatar_url (TEXT)
   - updated_at (TIMESTAMP)

2. **scan_history**
   - id (UUID, Primary Key)
   - user_id (UUID, Foreign Key → profiles.id)
   - posture_type (TEXT: 'salutation', 'marching', 'attention')
   - score (INTEGER: 0-100)
   - success (BOOLEAN)
   - feedback (TEXT)
   - timestamp (TIMESTAMP)

3. **weekly_progress**
   - id (UUID, Primary Key)
   - user_id (UUID, Foreign Key → profiles.id)
   - week_start (DATE)
   - week_end (DATE)
   - total_scans (INTEGER)
   - successful_scans (INTEGER)
   - average_score (DECIMAL)
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)

#### **Database Features**
- **Row Level Security (RLS)**
  - User-specific data isolation
  - Policy-based access control
  - Automatic authentication checks

- **Database Functions**
  - handle_new_user(): Auto-create profiles
  - Weekly aggregation functions

- **Triggers**
  - on_auth_user_created: Profile creation trigger

- **Indexes**
  - user_id indexes for fast lookups
  - timestamp indexes for date queries
  - Unique constraints on usernames

#### **Data Migration**
- SQL scripts for schema setup
- Version-controlled migrations
- Rollback capabilities

### 7.4 DevOps & Deployment

#### **Version Control**
- **Git** with GitHub
  - Feature branching
  - Pull request workflow
  - Code reviews

#### **CI/CD**
- **Vercel**
  - Automatic deployments
  - Preview deployments
  - Production builds
  - Environment variables

#### **Hosting**
- **Vercel Edge Network**
  - Global CDN
  - Edge functions
  - SSL/TLS certificates
  - Custom domains

#### **Monitoring**
- **Vercel Analytics**
  - Performance metrics
  - User analytics
  - Error tracking

### 7.5 Development Tools

#### **Package Manager**
- **npm** or **pnpm**
  - Dependency management
  - Script automation

#### **Linting & Formatting**
- **ESLint**
  - Code quality checks
  - TypeScript rules
- **Prettier**
  - Code formatting
  - Consistent style

#### **Testing** (Recommended)
- **Vitest** - Unit testing
- **Testing Library** - Component testing
- **Playwright** - E2E testing

---

## 8. Hardware & Software Requirements

### 8.1 Client-Side Requirements

#### **Minimum Hardware Requirements**
- **Processor**: Dual-core 1.5 GHz or higher
- **RAM**: 2 GB minimum, 4 GB recommended
- **Storage**: 500 MB available space
- **Camera**: Front-facing camera (minimum 2MP)
- **Display**: 5-inch screen minimum (1280x720 resolution)
- **Network**: 3G/4G mobile data or Wi-Fi

#### **Recommended Hardware Requirements**
- **Processor**: Quad-core 2.0 GHz or higher
- **RAM**: 6 GB or more
- **Storage**: 1 GB available space
- **Camera**: Front and back cameras (5MP or higher)
- **Display**: 6-inch screen (1920x1080 resolution)
- **Network**: 4G/5G or broadband Wi-Fi
- **GPU**: WebGL 2.0 capable GPU for acceleration

#### **Software Requirements - Mobile**
- **iOS**:
  - iOS 14.0 or later
  - Safari 14+ or Chrome for iOS 90+
  - Camera permissions enabled
  - Storage permissions enabled

- **Android**:
  - Android 10.0 or later
  - Chrome 90+ or Firefox 88+
  - Camera permissions enabled
  - Storage permissions enabled

#### **Software Requirements - Desktop**
- **Operating Systems**:
  - Windows 10/11
  - macOS 10.15 (Catalina) or later
  - Ubuntu 20.04 LTS or later

- **Web Browsers**:
  - Google Chrome 90+
  - Mozilla Firefox 88+
  - Microsoft Edge 90+
  - Safari 14+ (macOS)

- **Browser Features Required**:
  - JavaScript enabled
  - WebAssembly support
  - WebGL 2.0 support
  - MediaDevices API support
  - Local Storage enabled
  - IndexedDB support

### 8.2 Server-Side Requirements

#### **Backend Infrastructure** (Supabase Cloud)
- **Database Server**:
  - PostgreSQL 15+ instance
  - Minimum 1 vCPU, 2 GB RAM
  - 10 GB SSD storage (scalable)
  - Automatic backups

- **API Server**:
  - RESTful API endpoints
  - WebSocket support for real-time
  - Auto-scaling capability
  - Load balancing

- **Authentication Server**:
  - JWT token generation
  - Session management
  - OAuth providers support

#### **Hosting Infrastructure** (Vercel)
- **Edge Functions**:
  - Serverless compute
  - Node.js 18+ runtime
  - Automatic scaling
  - Global distribution

- **Static Assets**:
  - CDN distribution
  - Brotli compression
  - Cache optimization
  - HTTPS/TLS 1.3

#### **AI Model Storage**
- **Model Files**:
  - YOLOv8n-pose.onnx (~10 MB)
  - YOLOv8s-pose.onnx (~25 MB)
  - Public CDN hosting
  - Gzip compression

### 8.3 Development Environment Requirements

#### **Developer Hardware**
- **Processor**: Intel i5/AMD Ryzen 5 or better
- **RAM**: 8 GB minimum, 16 GB recommended
- **Storage**: 256 GB SSD minimum
- **Display**: 1920x1080 resolution or higher

#### **Developer Software**
- **Operating System**:
  - Windows 10/11, macOS 10.15+, or Ubuntu 20.04+

- **Development Tools**:
  - Node.js 18+ LTS
  - npm 9+ or pnpm 8+
  - Git 2.30+
  - VS Code or similar IDE

- **IDE Extensions**:
  - ESLint
  - Prettier
  - TypeScript support
  - Tailwind CSS IntelliSense

- **Additional Tools**:
  - Supabase CLI
  - Vercel CLI
  - Python 3.8+ (for model conversion)
  - Postman or similar (API testing)

### 8.4 Network Requirements

#### **Bandwidth Requirements**
- **Minimum**: 2 Mbps download, 1 Mbps upload
- **Recommended**: 5 Mbps download, 2 Mbps upload
- **Latency**: < 100ms to server
- **Packet Loss**: < 1%

#### **Ports & Protocols**
- **HTTPS**: Port 443 (outbound)
- **WebSocket**: Port 443 (for real-time features)
- **DNS**: Port 53 (UDP/TCP)

#### **API Endpoints**
- Supabase API: `https://<project>.supabase.co`
- Vercel deployment: `https://<app>.vercel.app`
- CDN: CloudFlare/Vercel Edge Network

### 8.5 Security Requirements

#### **Client-Side Security**
- Browser security features enabled
- Content Security Policy (CSP) compliance
- Secure cookie handling
- XSS protection

#### **Server-Side Security**
- TLS 1.3 encryption
- JWT token validation
- SQL injection prevention
- CORS configuration
- Rate limiting
- DDoS protection

#### **Data Security**
- Encrypted data transmission (HTTPS)
- Encrypted data at rest
- Secure password hashing (bcrypt)
- Row Level Security (RLS)
- Regular security audits

---

## Summary

The AlignMate CSU system is a comprehensive, cloud-based posture detection application that leverages modern web technologies and AI/ML capabilities to provide real-time posture analysis and feedback. The system follows Agile development methodologies, implements robust security measures, and ensures scalability and maintainability through careful architectural design.

**Key Highlights:**
- **Browser-based AI**: Local pose detection using YOLOv8 ONNX models
- **Real-time Processing**: 2 FPS detection with instant feedback
- **Cloud Backend**: Supabase for authentication, database, and storage
- **Progressive Web App**: Mobile-first, responsive design
- **Comprehensive Tracking**: Historical data and weekly progress analytics
- **Secure & Scalable**: Row Level Security, auto-scaling infrastructure

This documentation serves as a complete reference for understanding, developing, and maintaining the AlignMate CSU system.

---

**Document Version**: 1.0  
**Last Updated**: November 28, 2025  
**Project**: AlignMate CSU - Posture Detection System
