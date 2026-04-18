import os
from ultralytics import YOLO

print("\n==================================")
print("  StreetScan YOLO Model Fetcher")
print("==================================\n")

print("Checking and downloading 'yolov8n.pt' weights...")

try:
    # Explicitly fetching YOLOv8 nano model
    # This automatically downloads the weights from ultralytics if it does not exist
    model = YOLO('yolov8n.pt')
    print("\n✅ Success! yolov8n.pt model has been fetched and is ready locally.")
    print("You can safely start the FastAPI server via main.py now.\n")
except Exception as e:
    print(f"\n❌ Error downloading the model: {e}")
    print("Please make sure you have an active internet connection.")
