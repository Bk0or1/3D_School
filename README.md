# 🎓 Interactive 3D E-School
### Focused AI Tool for STEM Education | Built with Gemini Multimodal & Three.js
**Hacktoberfest Rwanda x Build54 Africa Hackathon Entry**  
*Optimized for Instant Deployment on the Adaption AI Cloud Platform*

---

## 🌟 Executive Summary

**Interactive 3D E-School** is a rapid-prototype web application that transforms abstract STEM subjects (Biology, Physics, and Chemistry) into immersive, interactive 3D simulations. 

It is paired with a **Multimodal AI Tutor** powered by the **Google Gemini API (targeting Gemma 4 / Gemini 1.5 multimodal capabilities)**. Students can physically manipulate 3D models, launch physics projectiles, trigger chemical reactions, and use the **"Snap 3D & Ask AI"** feature to capture their exact canvas view and receive real-time, context-aware visual explanations from specialized AI tutors.

---

## 🚀 Key Features

### 1. 🧬 Biology Laboratory: 3D Eukaryotic Cell Model
- **Interactive 3D Organelles**: Rotatable, zoomable eukaryotic cell featuring the Cell Membrane, Nucleus & Nucleolus, Mitochondria (with folding cristae), Endoplasmic Reticulum, and Ribosomes.
- **Raycasting Interaction**: Hovering or clicking any organelle highlights it and displays its cellular metabolic function.
- **Explode View**: Animates organelles outwards radially from the cell center to reveal internal architecture.
- **Cross-Section Slice**: Slices the outer membrane to inspect internal cross-sections.
- **AI Tutor**: **Dr. Helix** (Cellular Biology & Anatomy Specialist).

### 2. ⚡ Physics Laboratory: 3D Projectile Motion Simulator
- **Real-Time 3D Kinematics**: Cannon launcher with dynamic 3D angle elevation ($\theta$) and azimuth rotation.
- **Multi-Planetary Gravity**: Simulate trajectories on Earth ($9.8\text{ m/s}^2$), the Moon ($1.62\text{ m/s}^2$), Mars ($3.71\text{ m/s}^2$), and Jupiter ($24.79\text{ m/s}^2$).
- **Parabolic Trajectory Tracking**: Dynamic ribbon trail follows the projectile, contrasted against theoretical calculated dashed curves.
- **Live Telemetry HUD**: Real-time readouts for Flight Time ($t$), Range ($R$), and Maximum Altitude ($H_{max}$).
- **Impact Shockwave**: Visual particle burst upon ground collision.
- **AI Tutor**: **Prof. Newton** (Kinematics & Mechanics Specialist).

### 3. 🧪 Chemistry Laboratory: 3D Beaker & Reaction Simulator
- **Photorealistic Glass Beaker**: Transparent glass shader with graduated volumetric markings and magnetic stir plate.
- **Dynamic Fluid & Particle FX**:
  - **Effervescent Gas Evolution**: Micro-bubbles ascending and popping at the surface.
  - **Acid-Base Neutralization**: Chromatic color morphing from acidic yellow through neutral green to basic magenta with pH shift.
  - **Precipitation Reaction**: Insoluble precipitate clouds forming and settling ($AgCl\downarrow$).
  - **Exothermic Redox**: Fluid heating to 78°C with rising thermal vapor/steam particles.
- **Interactive Reagents**: Add Reagent A/B, trigger magnetic stirring, or clean beaker.
- **AI Tutor**: **Dr. Curie** (Reaction Kinetics & Molecular Specialist).

### 4. 📸 Multimodal "Snap 3D & Ask AI" Integration
- **Direct Canvas Capture**: One-click screenshot capture directly from the Three.js WebGL rendering buffer.
- **Image + Telemetry Multimodal Payload**: Packages the base64 snapshot together with active simulation variables (e.g., angle, velocity, selected organelle, pH, temperature).
- **Gemini 1.5 Flash / Gemma Multimodal**: Vision model analyzes visual landmarks in the user's current camera angle.
- **Built-in Intelligent Fallback**: Complete offline simulator guarantees seamless evaluation even without an immediate API key.
- **Web Speech Synthesis (TTS)**: High-quality voice narration reads tutor responses aloud for auditory learners.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | Python 3.9+, Flask, Flask-CORS, Gunicorn | Lightweight REST API & static asset serving |
| **AI / Multimodal** | Google Gemini API (`google-generativeai`), Gemma 4 | Vision & text reasoning for STEM queries |
| **3D Graphics** | Three.js (r128), OrbitControls | High-performance WebGL 3D rendering |
| **Frontend UI** | HTML5, Vanilla Modern CSS, Lucide Icons | Glassmorphic dark cyberpunk-academic UI |
| **Markdown / TTS** | Marked.js, DOMPurify, Web Speech API | Safe formatting & voice narration |
| **Deployment** | Adaption AI / Procfile / Gunicorn | Instant cloud deployment readiness |

---

## 📁 Project Structure

```
├── app.py                  # Flask backend with /api/chat multimodal endpoint & tutor personas
├── requirements.txt        # Production dependencies (Flask, google-generativeai, etc.)
├── Procfile                # Adaption AI cloud process entry point
├── runtime.txt             # Python runtime specification (3.9.18)
├── .env.example            # Environment variables template
├── README.md               # Project documentation & Hackathon guide
├── templates/
│   └── index.html          # Semantic HTML5 single page app with HUD & chat
└── static/
    ├── style.css           # Modern glassmorphism dark theme & responsive grid
    └── main.js             # Three.js 3D engine, physics/chemistry/biology scenes, AI chat
```

---

## ⚙️ Quickstart (Run Locally)

### 1. Clone & Enter Directory
```bash
cd "web{}()CL&my"
```

### 2. Activate Virtual Environment & Install Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure Gemini API Key (Optional for offline demo)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your free Gemini API key from [Google AI Studio](https://aistudio.google.com/):
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
```
*(Note: If no API key is provided, the application runs with its built-in intelligent STEM tutor simulator).*

### 4. Run the Application
```bash
python app.py
```
Open your browser at: **`http://localhost:5000`**

---

## ☁️ Adaption AI Cloud Deployment

This repository is built strictly according to 12-factor cloud deployment standards:

1. **Procfile**:
   ```
   web: gunicorn app:app --bind 0.0.0.0:$PORT
   ```
2. **Environment Variables on Adaption AI**:
   - `GEMINI_API_KEY`: *(Your Google AI Studio API key)*
   - `PORT`: *(Automatically assigned by Adaption AI)*
   - `SECRET_KEY`: *(Optional session secret)*
3. **Health Check Endpoint**:
   - `GET /api/health` returns `{ "status": "online", "gemini_configured": true }` for automated platform health checks.

---

## 🏆 Hackathon Alignment

- **Event**: Hacktoberfest Rwanda x Build54 Africa
- **Theme**: "Focused AI Tool" for Education
- **Impact**: Provides high-impact interactive STEM visual learning for resource-constrained classrooms using low-overhead browser 3D graphics and multimodal AI.
