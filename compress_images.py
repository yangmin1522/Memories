import os
import subprocess
from pathlib import Path

MEMORIES = Path('Memories')
COMPRESS_DIR = MEMORIES / 'compress'
FFMPEG_BIN = r'C:\ffmpeg\bin\ffmpeg.exe'

def compress_images():
    if not FFMPEG_BIN.endswith('ffmpeg.exe'):
        # Try system PATH
        ffmpeg_cmd = 'ffmpeg'
    else:
        ffmpeg_cmd = FFMPEG_BIN
    
    COMPRESS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Image and video extensions to compress
    supported_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.mov', '.mp4', '.avi', '.mkv'}
    
    compressed = 0
    failed = 0
    
    for item in MEMORIES.iterdir():
        if not item.is_file():
            continue
        if item.suffix.lower() not in supported_exts:
            continue
        
        outfile = COMPRESS_DIR / item.name
        
        # For images: use -q:v for quality (lower is better, ~5-10 is good for JPEG)
        # For videos: use -crf for quality (lower is better, ~20-28)
        if item.suffix.lower() in {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'}:
            # Compress image with reduced quality (80% of original)
            cmd = [
                ffmpeg_cmd, '-i', str(item), '-q:v', '5', '-y', str(outfile)
            ]
        else:
            # Compress video with reasonable bitrate
            cmd = [
                ffmpeg_cmd, '-i', str(item), '-crf', '23', '-preset', 'medium', '-y', str(outfile)
            ]
        
        try:
            print(f"Compressing: {item.name}...", end=' ')
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            
            orig_size = item.stat().st_size / (1024 * 1024)  # MB
            comp_size = outfile.stat().st_size / (1024 * 1024)  # MB
            ratio = (1 - comp_size / orig_size) * 100 if orig_size > 0 else 0
            
            print(f"OK ({orig_size:.2f}MB -> {comp_size:.2f}MB, {ratio:.1f}% reduction)")
            compressed += 1
        except Exception as e:
            print(f"FAILED - {e}")
            failed += 1
    
    print(f"\n=== Summary ===")
    print(f"Compressed: {compressed}")
    print(f"Failed: {failed}")
    print(f"Output directory: {COMPRESS_DIR.resolve()}")

if __name__ == '__main__':
    compress_images()
