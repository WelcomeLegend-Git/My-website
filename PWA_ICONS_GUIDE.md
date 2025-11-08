# PWA Icons Guide

## Quick Icon Generation

You need to create two icon files for your PWA:
- `apps/web/public/icon-192.png` (192x192 pixels)
- `apps/web/public/icon-512.png` (512x512 pixels)

### Option 1: Generate Online (Easiest)
1. Go to https://realfavicongenerator.net/
2. Upload your logo or design
3. Download the generated icons
4. Rename and place them in `apps/web/public/`

### Option 2: Use a Simple Design
1. Open any image editor (Paint, Photoshop, Figma, etc.)
2. Create a 512x512 canvas
3. Add your design:
   - Background: Dark blue/indigo (#6366f1)
   - Text: "JEE" in large white font
   - Or use a simple book/study icon
4. Export as PNG
5. Resize to 192x192 for the smaller icon

### Option 3: Use a Free Icon from:
- https://icon-icons.com/
- https://www.flaticon.com/
- https://icons8.com/

### Temporary Placeholder
For now, you can use the Vite logo as a placeholder:
```bash
cd apps/web/public
copy vite.svg icon-192.png
copy vite.svg icon-512.png
```

## Icon Requirements
- **Format**: PNG (transparent background preferred)
- **Sizes**: 192x192 and 512x512 pixels
- **Design**: Simple, recognizable, works on any background
- **Branding**: Should represent "JEE Study Companion"

## Recommended Design
- Background: Indigo gradient (#6366f1 to #4f46e5)
- Icon: Book + AI sparkle symbol
- Text: "JEE" (optional)
- Style: Modern, minimal, professional

## After Adding Icons
1. Place files in `apps/web/public/`
2. Build and test: `npm run build`
3. Test PWA installation on mobile device
4. Icons will appear when installed on home screen
