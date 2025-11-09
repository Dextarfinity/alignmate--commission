# 🎮 Command Reference - AlignMate CSU

Complete list of commands for working with local AI models.

---

## 📦 Initial Setup

### Install Python Dependencies (for model conversion)
```bash
pip install ultralytics onnx onnxruntime
```

### Install Node Dependencies (already done)
```bash
npm install
# Includes onnxruntime-web for local inference
```

---

## 🔄 Model Conversion

### Convert YOLOv8 Models to ONNX
```bash
npm run convert-models
```
**Or manually:**
```bash
python scripts/convert_models_to_onnx.py
```

**Output:**
- `public/models/yolov8n-pose.onnx` (~12 MB)
- `public/models/yolov8s-pose.onnx` (~25 MB)

**Verify:**
```bash
dir public\models
# Should show 2 .onnx files
```

---

## 🌐 Web Development

### Start Development Server
```bash
npm run dev
```
Visit: `http://localhost:5173`

### Build for Production
```bash
npm run build
```
Output: `dist/` folder (ready to deploy)

### Preview Production Build
```bash
npm run preview
```

### Lint Code
```bash
npm run lint
```

---

## 📱 Mobile Development (Ionic Capacitor)

### One-Time Mobile Setup
```bash
npm run setup:mobile
```
**Or manually:**
```bash
npm install @capacitor/core @capacitor/cli @capacitor/filesystem @capacitor/camera
npx cap init
```

### Initialize Capacitor Project
```bash
npx cap init
```
**Prompts:**
- App name: `AlignMate CSU`
- App ID: `com.alignmate.csu`
- Web directory: `dist`

### Add Android Platform
```bash
npx cap add android
```

### Add iOS Platform (macOS only)
```bash
npx cap add ios
```

### Build and Sync to Mobile
```bash
npm run sync:mobile
```
**Or manually:**
```bash
npm run build
npx cap copy
npx cap sync
```

### Open Android Project
```bash
npm run open:android
```
**Or:**
```bash
npx cap open android
```

### Open iOS Project (macOS only)
```bash
npm run open:ios
```
**Or:**
```bash
npx cap open ios
```

---

## 🔍 Testing & Debugging

### Check Model Files Exist
```bash
# Windows
dir public\models\*.onnx

# Linux/Mac
ls -lh public/models/*.onnx
```

### Test Model Conversion
```bash
python scripts/convert_models_to_onnx.py
```

### Check Build Output
```bash
# Windows
dir dist\models\*.onnx

# Linux/Mac
ls -lh dist/models/*.onnx
```

### View Server Logs
```bash
npm run dev
# Check terminal output for:
# ✅ Model loaded successfully
# 🔍 Attempting local pose detection
```

### Browser Console Commands
```javascript
// Check model status
hybridPostureService.getStatus()

// Check if local models available
await hybridPostureService.checkLocalModelsAvailable()

// Force model load
await hybridPostureService.initialize('nano')
```

---

## 🚀 Deployment

### Deploy to Vercel
```bash
npm run build
vercel deploy
```

### Deploy to Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

### Deploy to GitHub Pages
```bash
npm run build
# Then push dist/ folder to gh-pages branch
```

### Build Android APK
```bash
npm run build
npx cap sync
npm run open:android
# In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
```

### Build iOS App (macOS only)
```bash
npm run build
npx cap sync
npm run open:ios
# In Xcode: Product → Archive
```

---

## 🛠️ Maintenance

### Update Dependencies
```bash
npm update
```

### Update Capacitor
```bash
npm install @capacitor/core@latest @capacitor/cli@latest
npx cap sync
```

### Clean Build
```bash
# Remove dist folder
rmdir /s dist     # Windows
rm -rf dist       # Linux/Mac

# Rebuild
npm run build
```

### Clean Mobile Build
```bash
# Android
npx cap sync android --force

# iOS
npx cap sync ios --force
```

---

## 📊 Monitoring & Analytics

### Check Model Performance
```javascript
// In browser console
const status = localPoseDetection.getModelStatus()
console.log(status)
// { loaded: true, loading: false, error: null, model: 'yolov8n-pose' }
```

### Monitor Network Usage
- Open DevTools → Network tab
- Filter by `.onnx` to see model loading
- Local mode = 0 bytes transferred! ✅

### Check Memory Usage
- DevTools → Memory tab
- Models use ~150-200 MB
- WebAssembly in separate heap

---

## 🔧 Troubleshooting Commands

### Model Not Loading?
```bash
# 1. Verify files exist
dir public\models

# 2. Reconvert models
npm run convert-models

# 3. Rebuild app
npm run build

# 4. Clear cache and retry
# Ctrl+Shift+R in browser
```

### Capacitor Issues?
```bash
# Reinstall Capacitor
npm uninstall @capacitor/core @capacitor/cli
npm install @capacitor/core@latest @capacitor/cli@latest

# Reset platforms
npx cap sync
```

### Build Errors?
```bash
# Clear node modules and reinstall
rmdir /s node_modules    # Windows
rm -rf node_modules      # Linux/Mac
npm install

# Clear TypeScript cache
rmdir /s .tsc            # Windows  
rm -rf .tsc              # Linux/Mac
```

---

## 📝 Quick Reference

### Most Common Workflow

**Development:**
```bash
npm run dev
```

**First-Time Model Setup:**
```bash
npm run convert-models
```

**Production Build:**
```bash
npm run build
```

**Mobile Deployment:**
```bash
npm run sync:mobile
npm run open:android
```

---

## 🎯 Environment-Specific Commands

### Local Development
```bash
npm run dev
# Hot reload enabled
# Models loaded from public/models/
```

### Production Web
```bash
npm run build
npm run preview
# Optimized build
# Models in dist/models/
```

### Android Development
```bash
npm run build
npx cap sync android
npm run open:android
# Android Studio required
```

### iOS Development (macOS only)
```bash
npm run build
npx cap sync ios
npm run open:ios
# Xcode required
```

---

## 🔐 Security Commands

### Audit Dependencies
```bash
npm audit
npm audit fix
```

### Check for Vulnerabilities
```bash
npm audit --production
```

### Update Vulnerable Packages
```bash
npm audit fix --force
```

---

## 📚 Documentation Generation

### Update Documentation
Edit these files as needed:
- `QUICK_START.md`
- `LOCAL_MODEL_SETUP.md`
- `IMPLEMENTATION_SUMMARY.md`
- `ARCHITECTURE_DIAGRAM.md`
- `COMMANDS.md` (this file)

---

## 🎓 Learning Commands

### Explore Project Structure
```bash
# Windows
tree /F

# Linux/Mac
tree
```

### View Package Scripts
```bash
npm run
# Shows all available scripts
```

### Check Node/NPM Versions
```bash
node --version
npm --version
python --version
```

---

## 💡 Pro Tips

### Fast Development Iteration
```bash
# Terminal 1: Keep dev server running
npm run dev

# Terminal 2: Make changes, auto-reloads
# No need to restart!
```

### Quick Mobile Testing
```bash
# One command to build and sync
npm run sync:mobile

# Then just refresh in Android Studio/Xcode
```

### Performance Testing
```bash
# Build with production optimizations
npm run build
npm run preview

# Test in browser
# Check DevTools → Performance tab
```

---

## ⚡ Speed Optimizations

### Parallel Build (if supported)
```bash
npm run build -- --parallel
```

### Skip Type Checking (faster build)
```bash
vite build --mode development
```

### Cache ONNX Models
Models are automatically cached by browser after first load.
Clear with: Ctrl+Shift+R (hard refresh)

---

## 🎉 Success Indicators

After running commands, you should see:

### Model Conversion Success:
```
✅ Successfully converted yolov8n-pose
✅ Successfully converted yolov8s-pose
```

### Dev Server Success:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

### Build Success:
```
✓ built in XXXms
dist/index.html                    X.XX kB
dist/assets/index-XXXXX.js        XXX.XX kB
```

### Mobile Sync Success:
```
✔ Copying web assets from dist to android/app/src/main/assets/public
✔ Copying native bridge
✔ Copying capacitor.config.json
✔ copy android in XXXms
```

---

## 📞 Need Help?

1. Check browser console for errors
2. Verify model files exist: `dir public\models`
3. Try reconverting: `npm run convert-models`
4. Check documentation: `LOCAL_MODEL_SETUP.md`
5. Review architecture: `ARCHITECTURE_DIAGRAM.md`

---

**All commands tested and ready to use! 🚀**
