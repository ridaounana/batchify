import sys
import os

def check_dependencies():
    try:
        from PIL import Image
    except ImportError:
        print("Required Pillow library not found. Installing 'pillow'...")
        import subprocess
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "pillow"], check=True)
            print("Pillow installed successfully.")
        except Exception as e:
            print(f"Failed to auto-install pillow: {e}")
            sys.exit(1)

def main():
    check_dependencies()
    from PIL import Image

    if len(sys.argv) < 3:
        print("Usage: python convert_to_png.py <input_path> <output_path>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' not found.")
        sys.exit(1)

    try:
        print(f"Converting {input_path} to PNG format...")
        im = Image.open(input_path)
        im = im.convert("RGBA")
        im.save(output_path, "PNG")
        print("Image format conversion completed successfully.")
    except Exception as e:
        print(f"Error during image conversion: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
