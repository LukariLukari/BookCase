'use client';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File as FileIcon, Loader2 } from 'lucide-react';
import axios from 'axios';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    const title = file.name.replace(/\.[^/.]+$/, "");
    formData.append('title', title);

    try {
      await axios.post('http://localhost:8000/api/books/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      
      onUploadSuccess();
      setFile(null);
      onClose();
    } catch (error) {
      console.error('Lỗi upload:', error);
      alert('Tải lên thất bại. Vui lòng kiểm tra lại backend.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={!isUploading ? onClose : undefined}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl z-10"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-black">Upload New Book</h3>
              <button 
                onClick={onClose}
                disabled={isUploading}
                className="text-gray-400 hover:text-black disabled:opacity-50 bg-gray-100 p-2 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div 
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                file ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
              } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.epub"
                className="hidden" 
              />
              
              {file ? (
                <div className="flex flex-col items-center">
                  <FileIcon size={48} className="text-orange-500 mb-4" />
                  <p className="text-black font-semibold mb-1 truncate max-w-[200px]">{file.name}</p>
                  <p className="text-gray-500 text-sm">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload size={48} className="text-gray-300 mb-4" />
                  <p className="text-black font-semibold mb-2">Click to select file</p>
                  <p className="text-gray-500 text-sm">Supported formats: .PDF, .EPUB</p>
                </div>
              )}
            </div>

            {isUploading && (
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 font-medium">Uploading...</span>
                  <span className="text-orange-500 font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="mt-8">
              <button 
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full py-3.5 rounded-xl bg-black hover:bg-gray-800 text-white font-bold disabled:opacity-50 disabled:hover:bg-black flex items-center justify-center transition-colors"
              >
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : 'Upload Book'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
