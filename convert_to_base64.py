#!/usr/bin/env python3
"""
Convert all images in Memories folder to Base64 and create a manifest JSON.
This allows embedding images directly in the manifest for faster loading.
"""

import os
import base64
import json
from pathlib import Path

def convert_images_to_base64(memories_dir='Memories', output_file='Memories/manifest_base64.json'):
    """
    Convert all image files in memories_dir to Base64 and save as JSON manifest.
    """
    memories_path = Path(memories_dir)
    
    if not memories_path.exists():
        print(f"Error: {memories_dir} folder not found!")
        return
    
    # Supported image extensions
    supported_exts = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif', '.bmp'}
    
    manifest = []
    total_size = 0
    skipped = 0
    
    # Get all image files
    image_files = sorted([f for f in memories_path.iterdir() 
                         if f.is_file() and f.suffix.lower() in supported_exts])
    
    print(f"Found {len(image_files)} image files in {memories_dir}")
    print("Converting to Base64...")
    
    for idx, img_file in enumerate(image_files, 1):
        try:
            with open(img_file, 'rb') as f:
                img_data = f.read()
                file_size = len(img_data)
                total_size += file_size
                
                # Convert to Base64
                base64_str = base64.b64encode(img_data).decode('utf-8')
                
                # Determine MIME type
                ext = img_file.suffix.lower()
                mime_map = {
                    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                    '.png': 'image/png', '.webp': 'image/webp',
                    '.heic': 'image/heic', '.gif': 'image/gif',
                    '.bmp': 'image/bmp'
                }
                mime_type = mime_map.get(ext, 'image/jpeg')
                
                # Create data URI
                data_uri = f"data:{mime_type};base64,{base64_str}"
                
                manifest.append({
                    "name": img_file.name,
                    "uri": data_uri
                })
                
                print(f"  [{idx}/{len(image_files)}] {img_file.name} ({file_size/1024:.1f} KB)")
        
        except Exception as e:
            print(f"  [SKIP] {img_file.name}: {str(e)}")
            skipped += 1
    
    # Write manifest
    output_path = Path(output_file)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    total_size_mb = total_size / (1024 * 1024)
    print(f"\n✓ Converted {len(manifest)} images (Skipped: {skipped})")
    print(f"✓ Total size: {total_size_mb:.2f} MB")
    print(f"✓ Manifest saved to: {output_file}")
    print(f"\nNext step: Update christmas.js to load 'Memories/manifest_base64.json'")

if __name__ == '__main__':
    convert_images_to_base64()
