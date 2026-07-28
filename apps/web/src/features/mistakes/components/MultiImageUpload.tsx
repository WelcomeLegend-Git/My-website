import { useState, useRef } from 'react';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  caption?: string;
}

interface MultiImageUploadProps {
  maxImages?: number;
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
}

export const MultiImageUpload = ({
  maxImages = 10,
  images,
  onChange,
  disabled = false,
}: MultiImageUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || disabled) return;

    const remainingSlots = maxImages - images.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);

    const newImages: UploadedImage[] = filesToAdd.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      caption: '',
    }));

    onChange([...images, ...newImages]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleFiles(e.target.files);
  };

  const removeImage = (id: string) => {
    const imageToRemove = images.find((img) => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onChange(images.filter((img) => img.id !== id));
  };

  const updateCaption = (id: string, caption: string) => {
    onChange(
      images.map((img) =>
        img.id === id ? { ...img, caption } : img
      )
    );
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {canAddMore && (
        <div
          className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200 ${
            dragActive
              ? 'border-brass bg-brass-soft'
              : 'border-line hover:border-brass/40'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <div className="p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brass-soft">
              <svg
                className="h-8 w-8 text-brass"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-ink mb-1">
              {dragActive ? 'Drop images here' : 'Upload mistake photos'}
            </p>
            <p className="text-sm text-ink-muted mb-2">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-ink-muted">
              {images.length} / {maxImages} images • PNG, JPG up to 10MB each
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleChange}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-xl border border-line bg-surface-2"
            >
              {/* Image Preview */}
              <div className="aspect-square overflow-hidden bg-paper">
                <img
                  src={image.preview}
                  alt={`Upload ${index + 1}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </div>

              {/* Image Number Badge */}
              <div className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-brass text-xs font-bold text-ink">
                {index + 1}
              </div>

              {/* Remove Button */}
              <button
                onClick={() => removeImage(image.id)}
                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                disabled={disabled}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Caption Input */}
              <div className="p-2">
                <input
                  type="text"
                  placeholder="Add caption (optional)"
                  value={image.caption || ''}
                  onChange={(e) => updateCaption(image.id, e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink placeholder:text-ink-muted focus:border-brass/50 focus:outline-none focus:ring-1 focus:ring-brass/20"
                  disabled={disabled}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!canAddMore && (
        <p className="text-center text-sm text-ink-muted">
          Maximum {maxImages} images reached
        </p>
      )}
    </div>
  );
};
