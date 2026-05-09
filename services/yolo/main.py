import io
import cv2
import os
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

app = FastAPI(title="StreetScan YOLO Service")

# Add CORS Middleware to allow cross-origin requests (e.g., from your Vercel frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple API Key Security
API_KEY = os.getenv("YOLO_API_KEY", "dev-yolo-secret")
api_key_header = APIKeyHeader(name="X-Api-Key", auto_error=False)

async def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header == API_KEY:
        return api_key_header
    raise HTTPException(status_code=403, detail="Could not validate API Key")

# Load a pretrained YOLOv8n model
model = YOLO('yolov8n.pt')

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"status": "online", "model": "yolov8n"}

@app.post("/analyze", dependencies=[Depends(get_api_key)])
async def analyze_image(file: UploadFile = File(...)):
    """
    Accepts an image, runs YOLOv8 inference, and returns damage area in pixels.
    Requires X-Api-Key header.
    """
    # Read image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image format")

    # Run inference
    results = model.predict(img, conf=0.25)

    detections = []
    total_pixel_area = 0

    for r in results:
        boxes = r.boxes
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            w = x2 - x1
            h = y2 - y1
            area = w * h
            
            total_pixel_area += area
            
            detections.append({
                "class_id": int(box.cls),
                "class_name": model.names[int(box.cls)],
                "confidence": float(box.conf),
                "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                "pixel_area": round(area, 2)
            })

    return {
        "damage_detected": len(detections) > 0,
        "total_pixel_area": round(total_pixel_area, 2),
        "detections": detections,
        "image_info": {
            "width": img.shape[1],
            "height": img.shape[0],
            "channels": img.shape[2]
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
