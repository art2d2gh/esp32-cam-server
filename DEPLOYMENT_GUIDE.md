# 🌐 Deploy ESP32-CAM Server Online (FREE)

## Option 1: Vercel (Recommended - Easiest)

### Step 1: Prepare for Deployment
1. **Create a GitHub account** if you don't have one: https://github.com
2. **Install Git** if you don't have it: https://git-scm.com/downloads

### Step 2: Push Your Code to GitHub
```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit your code
git commit -m "Initial ESP32-CAM server"

# Create repository on GitHub (go to github.com and create new repo)
# Then connect your local repo:
git remote add origin https://github.com/YOUR_USERNAME/esp32-cam-server.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel
1. **Go to https://vercel.com**
2. **Sign up with GitHub**
3. **Click "New Project"**
4. **Import your esp32-cam-server repository**
5. **Add Environment Variables**:
   - `SUPABASE_URL`: https://ysoqstmjrpyzdwkmtuyf.supabase.co
   - `SUPABASE_ANON_KEY`: [your anon key from .env file]
   - `NODE_ENV`: production
6. **Click Deploy**

### Step 4: Get Your Live URL
- Vercel will give you a URL like: `https://esp32-cam-server-xxx.vercel.app`
- Your ESP32-CAM will connect to this URL instead of localhost

---

## Option 2: Railway (Alternative)

### Step 1: Deploy to Railway
1. **Go to https://railway.app**
2. **Sign up with GitHub**
3. **Click "New Project" → "Deploy from GitHub repo"**
4. **Select your esp32-cam-server repository**
5. **Add Environment Variables** (same as Vercel)
6. **Deploy**

---

## Option 3: Render (Alternative)

### Step 1: Deploy to Render
1. **Go to https://render.com**
2. **Sign up with GitHub**
3. **Click "New" → "Web Service"**
4. **Connect your GitHub repository**
5. **Settings**:
   - Build Command: `npm install`
   - Start Command: `npm start`
6. **Add Environment Variables** (same as above)
7. **Deploy**

---

## Update ESP32-CAM Code

Once deployed, update your ESP32-CAM code:

```cpp
// Replace this line:
const char* serverURL = "http://192.168.1.100:3000";

// With your live URL:
const char* serverURL = "https://your-app-name.vercel.app";
```

**Important**: Use `https://` (not `http://`) for online deployment!

---

## Testing Your Deployment

### 1. Check if server is running
- Visit your live URL in browser
- You should see the ESP32-CAM web interface

### 2. Test with simulator
Update `test-esp32.js`:
```javascript
const SERVER_URL = 'https://your-app-name.vercel.app';
```

Then run: `npm run test-esp32`

### 3. Flash your ESP32-CAM
- Update the `serverURL` in your Arduino code
- Flash your ESP32-CAM
- It should appear in your online web interface!

---

## Advantages of Online Deployment

✅ **Access from anywhere** - Control your camera remotely
✅ **No port forwarding** - No router configuration needed
✅ **HTTPS security** - Encrypted communication
✅ **Free hosting** - No monthly costs
✅ **Automatic scaling** - Handles multiple cameras
✅ **Global CDN** - Fast loading worldwide

---

## Troubleshooting

### Deployment Failed
- Check that all files are committed to GitHub
- Ensure package.json has correct dependencies
- Check build logs for errors

### ESP32-CAM Can't Connect
- Verify the URL is correct (https://, not http://)
- Check that environment variables are set correctly
- Ensure Supabase is accessible from the internet

### Database Issues
- Supabase should work automatically with online deployment
- Check that your Supabase project is not paused
- Verify environment variables are correct

---

## Security Notes

For production use, consider:
- Adding authentication to your web interface
- Using API keys for ESP32-CAM connections
- Setting up CORS properly for your domain
- Using Supabase Row Level Security (RLS)

---

## Cost Considerations

**Free Tier Limits**:
- **Vercel**: 100GB bandwidth/month, 100 deployments/day
- **Railway**: 500 hours/month, $5 credit
- **Render**: 750 hours/month

These limits are generous for personal ESP32-CAM projects!

---

## Next Steps

1. **Choose a platform** (Vercel recommended)
2. **Push code to GitHub**
3. **Deploy and get your live URL**
4. **Update ESP32-CAM code with live URL**
5. **Flash and test your camera**
6. **Access your camera from anywhere!** 🌍
