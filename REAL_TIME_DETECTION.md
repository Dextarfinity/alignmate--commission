# 🎥 Real-Time Pose Detection System

## Overview

The Camera page now features **continuous real-time pose detection** that automatically analyzes and saves good postures without any manual scanning or timers.

---

## ✨ Key Features

### **1. Continuous Analysis**
- ✅ No countdown timer needed
- ✅ Analyzes posture every 500ms (2 FPS)
- ✅ Live score display overlayed on video
- ✅ Instant visual feedback

### **2. Smart Auto-Save**
Only saves to database when ALL conditions are met:
- ✅ **Confidence > 70%** (reliable detection)
- ✅ **Score ≥ 75%** (good posture quality)
- ✅ **3+ seconds** since last save (prevents spam)

### **3. Visual Feedback**

#### Video Border:
- 🟣 **Purple border**: Real-time detection active
- 🟢 **Green pulsing border**: Good posture detected (about to save!)

#### Live Score Display:
- 🌟 **Green (85%+)**: "EXCELLENT!"
- ✅ **Yellow (75-84%)**: "GOOD!"
- ⚠️ **Red (<75%)**: "ADJUST"

#### Info Card:
Shows current detection status:
- Live score percentage
- Posture status (Excellent, Good, Fair, etc.)
- Confidence level
- Auto-save indicator

---

## 🎮 How to Use

### **Start Real-Time Detection:**
1. Select posture type (salutation, marching, or attention)
2. Click **"🎯 START REAL-TIME DETECTION"**
3. Position yourself in frame
4. Hold good posture for 3+ seconds
5. System automatically saves when posture is good!

### **Stop Detection:**
- Click **"🛑 STOP REAL-TIME DETECTION"**
- Live score disappears
- No more auto-saves

---

## 📊 Detection Flow

```
┌─────────────────────────────────────────┐
│  User stands in front of camera         │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Real-time loop (every 500ms)           │
│  1. Capture frame                       │
│  2. Analyze with hybrid service         │
│  3. Update live display                 │
└─────────────────┬───────────────────────┘
                  ↓
           ┌──────┴──────┐
           ↓             ↓
    Good Posture?    Bad Posture?
    (Score ≥75%)     (Score <75%)
           ↓             ↓
    ┌──────────┐    ┌──────────┐
    │ Check:   │    │ Show     │
    │ • Conf>70│    │ feedback │
    │ • 3+ sec │    │ only     │
    └────┬─────┘    └──────────┘
         ↓
    ┌──────────┐
    │ Save to  │
    │ database │
    │ + Toast  │
    └──────────┘
```

---

## 💾 Database Saves

### **What Gets Saved:**
```javascript
{
  user_id: "...",
  posture_type: "salutation" | "marching" | "attention",
  score: 75-100,
  success: true,
  feedback: "Excellent posture! [📱 Local AI]",
  created_at: "2025-11-09T..."
}
```

### **Saved to Table:**
- `scan_history` - All detected postures
- Automatically updates `weekly_progress` via trigger

### **When It Saves:**
✅ Salutation detected with 85% score
✅ Marching detected with 78% score  
✅ Attention detected with 90% score

❌ Any posture with score < 75%
❌ Detection with low confidence (< 70%)
❌ Within 3 seconds of previous save

---

## 🎯 Posture Detection Logic

### **Salutation:**
- Right hand raised to forehead level
- Straight posture
- Shoulders level
- Score ≥75% → Auto-save

### **Marching:**
- Ready stance
- Arms at sides
- Balanced weight distribution
- Score ≥75% → Auto-save

### **Attention:**
- Rigid posture
- Arms straight at sides
- Heels together
- Score ≥75% → Auto-save

---

## 🔧 Technical Details

### **Performance:**
- Detection interval: 500ms (2 FPS)
- Uses `requestAnimationFrame` for smooth updates
- Minimal CPU usage during idle
- GPU-accelerated via ONNX Runtime Web

### **Memory Management:**
- Automatic cleanup on component unmount
- Cancels animation frames when stopped
- No memory leaks

### **Code Structure:**
```typescript
// Main toggle
toggleRealTimeDetection()

// Detection loop
runRealTimeDetection()
  → captureImage()
  → hybridPostureService.analyzePosture()
  → updateLiveDisplay()
  → checkAutoSaveConditions()
  → savePostureResult() [if conditions met]

// Auto-save handler
savePostureResult()
  → Insert to scan_history
  → Update weekly_progress
  → Show toast notification
```

---

## 📱 Mobile Compatibility

Works perfectly with Ionic Capacitor:
- ✅ Real-time detection on iOS
- ✅ Real-time detection on Android
- ✅ Efficient battery usage (500ms interval)
- ✅ Works offline with local models

---

## 🎨 UI Components

### **Status Indicators:**
```jsx
🟣 "LIVE DETECTION" - Purple badge with ping animation
📊 Live score display - Updates in real-time
✅ "Good posture detected! Auto-saving..." - Green text
```

### **Button States:**
```jsx
// Active
"🛑 STOP REAL-TIME DETECTION" - Red gradient

// Inactive  
"🎯 START REAL-TIME DETECTION" - Purple gradient

// Disabled
"⚡ INITIALIZING SCANNER..." - Gray
```

---

## 🔍 Debugging

### **Check Console:**
```javascript
// Real-time detection started
"🔄 Starting real-time detection..."

// Good posture detected
"✅ Good posture detected, auto-saving..."

// Saved to database
"✅ Posture result saved to database"
```

### **Monitor Performance:**
```javascript
// In browser DevTools → Performance
// Look for:
// - requestAnimationFrame calls (every 500ms)
// - hybridPostureService.analyzePosture (duration)
// - Database inserts (when auto-saving)
```

---

## ⚙️ Configuration

### **Adjust Detection Speed:**
```typescript
// In runRealTimeDetection()
setTimeout(() => {
  animationFrameRef.current = requestAnimationFrame(runRealTimeDetection)
}, 500) // ← Change this (ms)

// Faster: 250ms (4 FPS) - more CPU usage
// Slower: 1000ms (1 FPS) - less CPU usage
```

### **Adjust Save Threshold:**
```typescript
// In runRealTimeDetection()
if (
  result.confidence > 0.7 &&    // ← Adjust confidence
  result.overall_score >= 75 &&  // ← Adjust score threshold
  timeSinceLastSave >= MIN_SAVE_INTERVAL  // ← Adjust in state (3000ms)
)
```

### **Adjust Minimum Save Interval:**
```typescript
// In component state
const MIN_SAVE_INTERVAL = 3000 // ← Change this (ms)

// 2 seconds: 2000
// 5 seconds: 5000
// 10 seconds: 10000
```

---

## 🆚 Comparison: Old vs New

### **Old System (Timer-Based):**
- ❌ Required button click
- ❌ 5-second countdown
- ❌ Manual capture
- ❌ Saved every scan (even bad postures)
- ❌ No live feedback

### **New System (Real-Time):**
- ✅ Automatic continuous detection
- ✅ No countdown needed
- ✅ Auto-capture every 500ms
- ✅ Smart auto-save (only good postures)
- ✅ Live score display
- ✅ Visual feedback
- ✅ More natural user experience

---

## 🎓 User Experience

### **Typical Flow:**

1. **User arrives at Camera page**
   - Sees video feed
   - Selects posture type

2. **User clicks "START REAL-TIME DETECTION"**
   - Purple border appears
   - Live score shows at bottom
   - Info card shows detection status

3. **User performs posture**
   - Score updates in real-time
   - Border turns green when posture is good
   - "Good posture detected! Auto-saving..." appears

4. **System auto-saves**
   - Toast notification: "✅ SALUTATION: 92% saved!"
   - Entry added to scan history
   - Weekly stats updated

5. **User continues or switches posture**
   - Can maintain same posture for multiple saves (every 3+ seconds)
   - Can switch to different posture type
   - Can stop detection anytime

---

## ✅ Benefits

### **For Users:**
- 🎯 More natural interaction
- 📊 Instant feedback
- 💪 Practice posture with live guidance
- 🎮 Gamification (try to maintain high score)
- 📈 More data points collected

### **For System:**
- 🗄️ Higher quality data (only good postures saved)
- 📉 Reduced database spam
- 🔄 Better user engagement
- 📊 More accurate weekly stats

---

## 🚀 Future Enhancements

Potential additions:
- 🎵 Audio feedback when good posture detected
- 📹 Video recording of practice sessions
- 📊 Real-time posture correction hints
- 🏆 Achievements for maintaining postures
- 📈 Live graph of score over time
- 🤝 Multi-person detection
- 🎭 Pose transitions detection

---

## 🎉 Summary

The real-time detection system provides:
- ✅ **Zero-friction** user experience
- ✅ **Smart auto-save** (only quality data)
- ✅ **Live feedback** for instant correction
- ✅ **Continuous monitoring** without interruption
- ✅ **Professional feel** like fitness apps

**Perfect for military posture training and practice!** 🎖️
