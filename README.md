# 🛣️ StreetScan — AI-Powered Infrastructure Health Monitor

Full-stack Next.js 14 + Supabase platform for real-time detection and management of road and infrastructure damage via IoT sensors, computer vision (YOLOv8), and Gemini 1.5 Flash.

---

## 🚀 Vision
StreetScan transforms urban maintenance from reactive to proactive. By combining edge-computing (ESP32) with cutting-edge AI (YOLOv8 + Gemini), we identify road hazards, quantify their severity, and automate the logistical chain of repairs before they become critical failures.

---

## ✨ Key Features
- **🛰️ Node Network (IoT):** Real-time vibration telemetry via ESP32 + MPU6050 with automatic anomaly detection.
- **👁️ AI Vision Pipeline:** YOLOv8 integration for high-speed pothole/crack detection on dashcam feeds.
- **🧠 Semantic Analysis:** Gemini 1.5 Flash processing for detailed damage quantification and structural risk assessment.
- **🕹️ Tactical Command Center:** Premium administrative dashboard for real-time monitoring and node management.
- **⚡ Automated Logistics:** Intelligent ticket ingestion that auto-assigns field units based on report confidence.
- **📱 Citizen Portal:** Glassmorphic mobile-ready interface for public reporting with AI-assisted verification.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Data Sources                         │
│  ESP32+MPU6050 (IoT)  │  YOLOv8/Camera  │ Citizen Portal │
└────────────┬──────────┴─────┬────────────┴────────┬───────┘
             │                │                     │
          Node Key         Image Feed            User JWT
             │                │                     │
┌────────────▼────────────────▼─────────────────────▼──────┐
│                    API Layer (Next.js)                   │
│  /api/iot  /api/validate  /api/reports  /api/tickets     │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  Service Layer                           │
│  Gemini 1.5 Flash  │  YOLOv8 Wrapper  │  Workflow Engine │
│  Geo-Clustering    │  Notification JS │  Job Dispatch    │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│              Supabase (DB + Auth + Storage)              │
│  users │ devices │ iot_data │ reports │ clusters │ tickets│
└──────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Framer Motion, Lucide icons.
- **Backend:** Supabase (PostgreSQL, RLS, Realtime), Edge Functions.
- **AI:** Ultralytics YOLOv8 (Edge Vision), Google Gemini 1.5 Flash (Semantic Analysis).
- **Hardware:** ESP32, MPU6050 (Accelerometer/Gyro), C++/Arduino.

---

## 🚦 Quick Start

### 1. Environment Setup
```bash
git clone https://github.com/saswat-ss/streetscan.git
cd streetscan
npm install
cp .env.local.example .env.local
```
Fill in your `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `GEMINI_API_KEY`.

### 2. Database Initialization
1. Create a [Supabase](https://supabase.com) project.
2. Run the migration: `supabase/migrations/002_full_schema.sql`.
3. Create public storage buckets: `report-images` and `resolution-images`.

### 3. Edge Vision Service (Python)
Install requirements for the local YOLO processor:
```bash
pip install -r services/yolo/requirements.txt
python services/yolo/main.py
```

### 4. Application Run
```bash
npm run dev
```

---

## 📡 IoT Node Setup
Connect an ESP32 with an MPU6050 sensor to monitor road quality in the field.
- **Firmware:** Located in `streetscan_esp32.ino`.
- **Authentication:** Nodes use the `X-Api-Key` header with a unique `device_key`.
- **Real-time Stream:** View live vibration RMS data in the **Node Network** tab of the dashboard.

---

## 🎟️ Ticket Workflow
Our automated pipeline follows a 5-step lifecycle:
1. **Ingestion:** IoT or Citizen report received.
2. **AI Validation:** Gemini/YOLO verifies the damage and scores severity (0-100).
3. **Clustering:** Duplicate reports within a 15m radius are merged.
4. **Auto-Assignment:** Tickets are automatically dispatched to the primary field worker (`worker@streetscan.com`).
5. **Resolution:** Field teams upload verification images to close the loop.

---

## 📄 License
MIT © StreetScan Project