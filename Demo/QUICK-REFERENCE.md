# Quick Reference Card - What You Need to Do

**Print this page and check off as you complete each step**

---

## 🎯 THE 30-MINUTE SETUP

### PHASE 1: VAPI CONFIGURATION (10 minutes)

**Location:** dashboard.vapi.ai

- [ ] **Create Assistant**
  - Name: `EbookGov-Demo-AZ`
  - Click "Create"

- [ ] **Voice Setup**
  - Provider: 11labs
  - Voice ID: `21m00Tcm4TlvDq8ikWAM`
  - Stability: 0.5
  - Similarity: 0.75

- [ ] **Model Setup**
  - Provider: Cerebras (or OpenAI)
  - Model: llama-3.3-70b
  - Temperature: 0.7
  - Max Tokens: 500

- [ ] **Transcriber**
  - Provider: Deepgram
  - Model: nova-2
  - Language: en-US

- [ ] **First Message** (Copy exactly)
  ```
  Hi, this is Emma from EbookGov. I need to let you know 
  upfront that I'm an AI assistant. I'm here to help you 
  explore our rural Arizona properties and book showings. 
  Are you interested in checking out a specific property, 
  or would you like me to tell you what we have available?
  ```

- [ ] **System Prompt**
  - Copy entire prompt from: `02-system-prompt-updated.md`
  - Paste into Vapi System Prompt field

- [ ] **Add 3 Functions**
  - Function 1: `bookShowing` (copy JSON from config doc)
  - Function 2: `transferToHuman` (copy JSON from config doc)
  - Function 3: `getPropertyDetails` (copy JSON from config doc)

- [ ] **Buy Phone Number**
  - Go to Phone Numbers tab
  - Area code: +1-928 (Arizona)
  - Purchase number
  - Assign to: EbookGov-Demo-AZ
  - **SAVE THIS NUMBER:** `+1-928-_________`

---

### PHASE 2: WEBHOOK DEPLOYMENT (10 minutes)

**Choose ONE deployment method:**

**Option A: Heroku (Easiest)**
- [ ] `heroku login`
- [ ] `heroku create your-app-name`
- [ ] Copy `server.js` from `04-webhook-implementation.md`
- [ ] `git add .` && `git commit -m "Init"`
- [ ] `heroku config:set TEXTNOW_PHONE=+1XXXXXXXXXX`
- [ ] `git push heroku main`
- [ ] Copy your webhook URL: `https://your-app-name.herokuapp.com/api/vapi/webhook`

**Option B: Your Server**
- [ ] SSH into server
- [ ] `git clone your-repo` && `cd your-repo`
- [ ] `npm install` && `npm install -g pm2`
- [ ] Create `.env` file with credentials
- [ ] `pm2 start server.js`
- [ ] Configure nginx reverse proxy
- [ ] Your webhook URL: `https://your-domain.com/api/vapi/webhook`

**Option C: AWS Lambda**
- [ ] Follow AWS Lambda Node.js deployment
- [ ] Get endpoint URL from serverless output

---

### PHASE 3: TEXTNOW SETUP (5 minutes)

- [ ] Go to **textnow.com**
- [ ] Sign up with email (FREE account)
- [ ] Get assigned phone number
- [ ] Download TextNow app on your smartphone
- [ ] Log in to app
- [ ] **SAVE THIS NUMBER:** `+1-_________________`
- [ ] Keep app installed & logged in during demos

---

### PHASE 4: UPDATE VAPI WEBHOOK URL (2 minutes)

**Back in Vapi Dashboard:**

- [ ] Settings → Webhooks
- [ ] Enter webhook URL: `https://your-domain.com/api/vapi/webhook`
- [ ] Enable events: `function-call`, `end-of-call-report`, `transcript`
- [ ] Click Save

---

### PHASE 5: DEMO WEBSITE (3 minutes)

- [ ] Copy HTML from `05-demo-website.html`
- [ ] Find this line in JavaScript:
  ```javascript
  const VAPI_PHONE_NUMBER = '+1928XXXXXXX';
  ```
- [ ] Replace with YOUR Vapi number
- [ ] Deploy website (GitHub Pages / Netlify / your domain)
- [ ] **TEST:** Click "Call Agent" - should open dialer

---

## ✅ VERIFICATION CHECKLIST

Before calling the demo real:

- [ ] **Vapi Assistant Created?** Go to dashboard.vapi.ai and confirm you see EbookGov-Demo-AZ
- [ ] **Phone Number Active?** Call your Vapi number - it should ring
- [ ] **Webhook Running?** `curl https://your-domain.com/api/vapi/webhook/health` → Should return response
- [ ] **System Prompt Loaded?** Call Vapi number, Emma should identify as AI
- [ ] **TextNow App Active?** App installed, logged in, ready to receive calls
- [ ] **Demo Website Live?** Visit website, see 5 properties, click "Call Agent"

---

## 🎬 FIRST TEST CALL (Do this!)

1. **Call your Vapi number** from any phone
2. **Listen for Emma's greeting** → Should hear AI disclosure
3. **Ask:** "What properties do you have?"
4. **Emma should list all 5 Arizona properties**
5. **Say:** "I want to see Mountain View Ranch"
6. **Provide name and phone when asked**
7. **Provide preferred date/time**
8. **Emma confirms booking**
9. **Say:** "Can I speak with someone about pricing?"
10. **Emma transfers** → Your TextNow phone should ring within 2-3 seconds
11. **Answer the call** → You should hear the demo caller

**If anything fails:** Check `08-troubleshooting.md`

---

## 📱 YOUR CRITICAL NUMBERS

**Save these somewhere safe:**

| Item | Number |
|------|--------|
| Vapi Phone Number | +1-928-_____________ |
| TextNow Phone Number | +1-___-___-_______ |
| Webhook URL | https://________________ |
| Demo Website | https://________________ |

---

## 💰 MONTHLY COST ESTIMATE

```
Vapi Usage (50 demos × 4 min): 200 min × $0.15 = $30
TextNow: FREE
Webhook Server (Heroku): $7 or FREE (github pages)
Domain: $10-15/year or existing domain

TOTAL: ~$30-40/month for 50+ demo calls
COST PER DEMO: $0.60 each

If you close even 1 agent per 10 demos → ROI = massive
```

---

## 🚀 LAUNCH SEQUENCE

### Day 1: Setup (45 minutes)
- Complete all phases above
- Run verification checklist
- Do first test call

### Day 2: Soft Launch (20 minutes)
- Call a friend to test full flow
- Share website with 2-3 agents for feedback
- Fix any issues found

### Day 3: Go Live (Ongoing)
- Share demo link with target real estate agents
- Receive incoming transfers on TextNow
- Practice your sales pitch

### Week 1: Optimize
- Record what works/doesn't from calls
- Adjust system prompt based on feedback
- Add more properties if needed

---

## 📞 DEMO PITCH SCRIPT

When agent calls and books showing, say this:

**"So what you just experienced is exactly what your clients would get—24/7 availability, instant property information, and seamless booking. This is our EbookGov booking agent in action. Would you like me to connect you with our team to discuss how this could work for YOUR listings?"**

**If they say YES:** Immediate transfer to your TextNow phone

**On the transfer call:**
1. Confirm they watched demo (they probably did)
2. Ask about their pain point (leads, hours, technology)
3. Explain how EbookGov solves it
4. Share pricing/packages
5. If interested → Schedule implementation call
6. Get their email for follow-up

---

## ⚠️ CRITICAL DON'Ts

❌ Don't deploy webhook with HTTP (use HTTPS)
❌ Don't skip the AI disclosure (it's required by law)
❌ Don't have TextNow app closed during demos (it won't receive calls)
❌ Don't use wrong Vapi phone number in website
❌ Don't edit the system prompt after launch (only if you know what you're doing)
❌ Don't try Twilio if TextNow works (it's free, don't pay)
❌ Don't ignore error logs (they tell you what broke)

---

## 🆘 If Something Breaks

**99% of issues are:**
1. **TextNow not receiving calls?** → Restart app
2. **Webhook not working?** → Check it's deployed and accessible
3. **Emma doesn't answer?** → Check Vapi assistant is "active"
4. **Transfer doesn't work?** → Verify webhook has your TextNow number in .env
5. **Website not working?** → Check phone number in JavaScript matches Vapi number

**See full troubleshooting: `08-troubleshooting.md`**

---

## 📊 SUCCESS METRICS (Track These)

```
During Demo Period:
• Calls received: ___
• Bookings created: ___
• Transfers completed: ___
• Agents who spoke with you: ___

From Successful Demos:
• Pricing quotes sent: ___
• New customers signed: ___
• Revenue generated: $___
• ROI (revenue / costs): ___x
```

---

## 🎓 After Launch: Next Improvements

Once the demo is running smoothly:

1. **Add admin dashboard** to view bookings in real-time
2. **Set up email notifications** when booking occurs
3. **Add more properties** to system prompt
4. **Record calls** for coaching/improvement
5. **A/B test different voices** (Emma vs others)
6. **Create follow-up email** sequence for agents
7. **Track conversion metrics** (calls → demos → sales)
8. **Optimize system prompt** based on real feedback

---

## 🎉 YOU'RE READY

You now have:
- ✅ Complete AI booking agent
- ✅ Free call transfer system
- ✅ Professional demo website
- ✅ Compliance built-in
- ✅ Scalable architecture
- ✅ All documentation

**Start now. You've got this! 🚀**

---

**Quick Reference Version:** 1.0  
**Last Updated:** January 14, 2026  
**Estimated Setup Time:** 30-45 minutes  
**Monthly Cost:** $10-20
