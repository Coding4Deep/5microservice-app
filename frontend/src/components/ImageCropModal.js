import getConfig from '../config';
import React, { useState, useRef, useEffect } from 'react';

const ImageCropModal = ({ isOpen, onClose, onSave, tempImageData }) => {
  const canvasRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [image, setImage] = useState(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (tempImageData && isOpen) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        // Center the crop area
        const centerX = (img.width - 200) / 2;
        const centerY = (img.height - 200) / 2;
        setCrop({
          x: Math.max(0, centerX),
          y: Math.max(0, centerY),
          width: Math.min(200, img.width),
          height: Math.min(200, img.height)
        });
      };
      const config = getConfig();
      img.src = `${config.PROFILE_SERVICE_URL}/api/temp-image/${tempImageData.temp_id}`;
    }
  }, [tempImageData, isOpen]);

  useEffect(() => {
    if (image && canvasRef.current) {
      drawCanvas();
    }
  }, [image, crop, scale]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Calculate display size
    const maxWidth = 400;
    const maxHeight = 400;
    const displayScale = Math.min(maxWidth / image.width, maxHeight / image.height);
    
    canvas.width = image.width * displayScale;
    canvas.height = image.height * displayScale;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // Draw crop overlay with transparency
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Clear crop area to show original image
    ctx.clearRect(
      crop.x * displayScale,
      crop.y * displayScale,
      crop.width * displayScale,
      crop.height * displayScale
    );
    
    // Draw crop border with better visibility
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      crop.x * displayScale,
      crop.y * displayScale,
      crop.width * displayScale,
      crop.height * displayScale
    );
    ctx.setLineDash([]);
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const displayScale = canvas.width / image.width;
    
    const x = (e.clientX - rect.left) / displayScale;
    const y = (e.clientY - rect.top) / displayScale;
    
    // Check if click is inside crop area
    if (x >= crop.x && x <= crop.x + crop.width && 
        y >= crop.y && y <= crop.y + crop.height) {
      setIsDragging(true);
      setDragStart({ x: x - crop.x, y: y - crop.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const displayScale = canvas.width / image.width;
    
    const x = (e.clientX - rect.left) / displayScale;
    const y = (e.clientY - rect.top) / displayScale;
    
    const newX = Math.max(0, Math.min(x - dragStart.x, image.width - crop.width));
    const newY = Math.max(0, Math.min(y - dragStart.y, image.height - crop.height));
    
    setCrop(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    onSave({
      temp_id: tempImageData.temp_id,
      crop_x: crop.x,
      crop_y: crop.y,
      crop_width: crop.width,
      crop_height: crop.height
    });
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3>Crop Profile Picture</h3>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>
        
        <div style={styles.content}>
          {image && (
            <div style={styles.canvasContainer}>
              <canvas
                ref={canvasRef}
                style={styles.canvas}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
          )}
          
          <div style={styles.controls}>
            <div style={styles.controlGroup}>
              <label>Crop Size:</label>
              <input
                type="range"
                min="100"
                max={Math.min(image?.width || 300, image?.height || 300)}
                value={crop.width}
                onChange={(e) => {
                  const size = parseInt(e.target.value);
                  setCrop(prev => ({
                    ...prev,
                    width: size,
                    height: size,
                    x: Math.max(0, Math.min(prev.x, image.width - size)),
                    y: Math.max(0, Math.min(prev.y, image.height - size))
                  }));
                }}
                style={styles.slider}
              />
              <span>{crop.width}px</span>
            </div>
          </div>
        </div>
        
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelButton}>
            Cancel
          </button>
          <button onClick={handleSave} style={styles.saveButton}>
            Save & Upload
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #eee'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666'
  },
  content: {
    padding: '20px',
    textAlign: 'center'
  },
  canvasContainer: {
    marginBottom: '20px',
    display: 'inline-block',
    border: '1px solid #ddd',
    borderRadius: '4px'
  },
  canvas: {
    cursor: 'move',
    display: 'block'
  },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  slider: {
    flex: 1,
    margin: '0 10px'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '20px',
    borderTop: '1px solid #eee'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default ImageCropModal;
