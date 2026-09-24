import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, RefreshCw } from 'lucide-react';

export default function CameraCaptureModal({ isOpen, onClose, onCapture, currentImage }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'camera' or 'upload'
  const [stream, setStream] = useState(null);
  const [capturedData, setCapturedData] = useState(currentImage || null);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedData(currentImage || null);
    }
  }, [isOpen, currentImage]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access camera. Please allow camera permissions or upload an image file instead.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedData(dataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedData(null);
    startCamera();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCapturedData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onCapture(capturedData);
    stopCamera();
    onClose();
  };

  const handleModalClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Upload Receipt / Proof Image
          </h3>
          <button
            onClick={handleModalClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => handleTabSwitch('upload')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File from Device
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('camera')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'camera'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Camera className="w-4 h-4" />
            Take Photo with Camera
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {activeTab === 'upload' && (
            <div className="space-y-4 text-center">
              {capturedData ? (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-64 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                  <img src={capturedData} alt="Proof preview" className="max-h-64 object-contain" />
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 hover:border-emerald-500 transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Click to browse or drag and drop image
                  </p>
                  <p className="text-xs text-slate-400 mb-4">PNG, JPG, JPEG up to 10MB</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl cursor-pointer shadow-md transition-all">
                    <span>Select File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {capturedData && (
                <div className="flex justify-center gap-3">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-200">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Change File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setCapturedData(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg hover:bg-rose-100"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="space-y-4">
              {cameraError ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-sm text-center">
                  {cameraError}
                </div>
              ) : capturedData ? (
                <div className="text-center space-y-3">
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-64 flex items-center justify-center bg-black">
                    <img src={capturedData} alt="Captured preview" className="max-h-64 object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retake Photo
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <button
                    type="button"
                    onClick={takePhoto}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-lg transition-transform active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    Capture Photo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleModalClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!capturedData}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Check className="w-4 h-4" />
            Attach Image
          </button>
        </div>
      </div>
    </div>
  );
}
