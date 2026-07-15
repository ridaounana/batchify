import sys
import os

def check_dependencies():
    try:
        from rembg import remove
        from PIL import Image
    except ImportError:
        print("Required dependencies not found. Auto-installing 'rembg[cpu]' and 'pillow'...")
        import subprocess
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "rembg[cpu]", "pillow"], check=True)
            print("Dependencies installed successfully.")
        except Exception as e:
            print(f"Failed to auto-install dependencies: {e}")
            sys.exit(1)

def main():
    check_dependencies()
    from rembg import remove
    from PIL import Image

    if len(sys.argv) < 3:
        print("Usage: python remove_bg.py <input_path> <output_path>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' not found.")
        sys.exit(1)

    try:
        print(f"Removing background from: {input_path}")
        input_image = Image.open(input_path)
        output_image = remove(input_image)
        output_image.save(output_path, "PNG")
        print("Background removal completed successfully.")
    except Exception as e:
        print(f"Error during background removal processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
