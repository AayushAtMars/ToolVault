import { useEffect, useCallback, useRef, useState } from 'react';
import { X, Upload, FileUp } from 'lucide-react';
import './ToolModal.css';

export default function ToolModal({ tool, onClose }) {
  const overlayRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [handleEscape]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!tool) return null;

  const hasUpload = tool.acceptedFormats && tool.acceptedFormats.length > 0;

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={tool.name}
    >
      <div className="modal">
        <div className="modal__header">
          <div className="modal__title-wrap">
            <span className="modal__icon">{tool.icon}</span>
            <h2 className="modal__title">{tool.name}</h2>
          </div>
          <button
            className="modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <p className="modal__desc">{tool.description}</p>

        {hasUpload ? (
          <div
            className={`modal__dropzone ${dragging ? 'modal__dropzone--active' : ''}`}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setDragging(false); }}
          >
            <FileUp size={32} className="modal__dropzone-icon" aria-hidden="true" />
            <p className="modal__dropzone-text">
              <strong>Click to upload</strong> or drag & drop
            </p>
            <p className="modal__dropzone-meta">
              {tool.acceptedFormats.join(', ')} · Max {tool.maxFileSize}
              {tool.multipleFiles && ' · Multiple files supported'}
            </p>
          </div>
        ) : (
          <div className="modal__textarea-wrap">
            <textarea
              className="modal__textarea"
              placeholder={`Paste your text here to use ${tool.name}...`}
              rows={6}
              aria-label="Input text"
            />
          </div>
        )}

        <button className="btn btn-primary modal__action">
          <Upload size={16} />
          Process with {tool.name}
        </button>

        <p className="modal__footer-note">
          🔒 Your files are processed locally and never stored on our servers.
        </p>
      </div>
    </div>
  );
}
