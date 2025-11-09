"""
YOLOv8 Model Converter - Convert .pt models to ONNX format
For use with onnxruntime-web in browser and mobile apps

Requirements:
    pip install ultralytics onnx onnxruntime

Usage:
    python convert_models_to_onnx.py
"""

from ultralytics import YOLO
import os
import shutil

def convert_yolov8_to_onnx(model_path, output_dir='public/models'):
    """
    Convert YOLOv8 .pt model to ONNX format optimized for web
    
    Args:
        model_path: Path to .pt model file
        output_dir: Directory to save ONNX model
    """
    print(f"\n{'='*60}")
    print(f"Converting {model_path} to ONNX format...")
    print(f"{'='*60}\n")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Load the model
    model = YOLO(model_path)
    
    # Get model name without extension
    model_name = os.path.splitext(os.path.basename(model_path))[0]
    
    # Export to ONNX with optimizations for web
    # Using dynamic batch size and optimized for inference
    onnx_path = model.export(
        format='onnx',
        imgsz=640,  # Standard YOLO input size
        dynamic=True,  # Dynamic batch size
        simplify=True,  # Simplify model for better performance
        opset=12,  # ONNX opset version (compatible with onnxruntime-web)
    )
    
    # Move to output directory
    output_path = os.path.join(output_dir, f'{model_name}.onnx')
    shutil.move(onnx_path, output_path)
    
    print(f"\n✅ Successfully converted {model_name}")
    print(f"📁 Saved to: {output_path}")
    print(f"📊 Model optimized for web and mobile deployment")
    
    # Print model info
    file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
    print(f"💾 File size: {file_size:.2f} MB")
    
    return output_path

def main():
    """Convert all YOLOv8 pose models to ONNX"""
    
    print("\n🚀 YOLOv8 Pose Model Converter for Web/Mobile")
    print("=" * 60)
    
    # Models to convert
    models = [
        'api/yolov8n-pose.pt',  # Nano - fastest, smallest
        'api/yolov8s-pose.pt',  # Small - balanced speed/accuracy
    ]
    
    converted_models = []
    
    for model_path in models:
        if os.path.exists(model_path):
            try:
                output_path = convert_yolov8_to_onnx(model_path)
                converted_models.append(output_path)
            except Exception as e:
                print(f"\n❌ Error converting {model_path}: {e}")
        else:
            print(f"\n⚠️  Model not found: {model_path}")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"✅ Conversion Complete!")
    print(f"{'='*60}")
    print(f"\n📦 Converted {len(converted_models)} model(s):")
    for path in converted_models:
        print(f"   - {path}")
    
    print("\n📝 Next steps:")
    print("   1. Models are now in public/models/ directory")
    print("   2. They will be served as static assets by Vite")
    print("   3. Use LocalPoseDetectionService to load and run models")
    print("   4. Models work offline in both web and mobile apps")
    
    print("\n💡 Recommended model:")
    print("   - yolov8n-pose.onnx: Best for mobile (smaller, faster)")
    print("   - yolov8s-pose.onnx: Better accuracy (larger, slower)")
    print()

if __name__ == '__main__':
    main()
