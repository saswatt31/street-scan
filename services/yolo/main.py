import io
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO

app = FastAPI(title="StreetScan YOLO Service")

# Load a pretrained YOLOv8n model
# Note: In production, swap with a custom-trained pothole model
model = YOLO('yolov8n.pt')

@app.get("/")
async def root():
    return {"status": "online", "model": "yolov8n"}

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Accepts an image, runs YOLOv8 inference, and returns damage area in pixels.
    """
    # Read image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return {"error": "Invalid image format"}, 400

    # Run inference
    # imgsz=640 is standard
    results = model.predict(img, conf=0.25)

    detections = []
    total_pixel_area = 0

    for r in results:
        # Get bounding boxes
        boxes = r.boxes
        for box in boxes:
            # Get coordinates
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
