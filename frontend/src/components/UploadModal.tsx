'use client';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File as FileIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

interface FileStatus {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export default function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        progress: 0,
        status: 'pending' as const,
      }));
      setFileStatuses(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // reset input
    }
  };

  const removeFile = (index: number) => {
    if (isUploading) return;
    setFileStatuses(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const pendingFiles = fileStatuses.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    let allSuccess = true;

    for (let i = 0; i < fileStatuses.length; i++) {
      if (fileStatuses[i].status === 'success') continue;

      setFileStatuses(prev => {
        const newStatuses = [...prev];
        newStatuses[i] = { ...newStatuses[i], status: 'uploading', progress: 0, errorMessage: undefined };
        return newStatuses;
      });

      const file = fileStatuses[i].file;
      const formData = new FormData();
      formData.append('file', file);
      const title = file.name.replace(/\.[^/.]+$/, "");
      formData.append('title', title);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');

      try {
        await axios.post(`${API_URL}/api/books/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setFileStatuses(prev => {
                const newStatuses = [...prev];
                newStatuses[i] = { ...newStatuses[i], progress: percentCompleted };
                return newStatuses;
              });
            }
          }
        });
        
        setFileStatuses(prev => {
          const newStatuses = [...prev];
          newStatuses[i] = { ...newStatuses[i], status: 'success', progress: 100 };
          return newStatuses;
        });
        
      } catch (error: any) {
        console.error(`Lỗi upload file ${file.name}:`, error);
        allSuccess = false;
        setFileStatuses(prev => {
          const newStatuses = [...prev];
          newStatuses[i] = { ...newStatuses[i], status: 'error', errorMessage: 'Tải lên thất bại' };
          return newStatuses;
        });
      }
    }

    setIsUploading(false);
    
    // Refresh library if at least one file succeeded
    const anySuccess = fileStatuses.some(f => f.status === 'success');
    if (anySuccess || allSuccess) {
      onUploadSuccess();
    }
    
    // Auto close if everything is successful
    if (allSuccess) {
      setTimeout(() => {
        handleModalClose();
      }, 1000);
    }
  };

  const handleModalClose = () => {
    if (isUploading) return;
    setFileStatuses([]);
    onClose();
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
            onClick={handleModalClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl z-10 flex flex-col max-h-[85vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-black">Upload Books</h3>
              <button 
                onClick={handleModalClose}
                disabled={isUploading}
                className="text-gray-400 hover:text-black disabled:opacity-50 bg-gray-100 p-2 rounded-full cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div 
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                isUploading ? 'pointer-events-none opacity-50 bg-gray-50 border-gray-200' : 'border-gray-300 hover:border-[#D7C9B2] hover:bg-gray-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.epub"
                className="hidden" 
              />
              
              <div className="flex flex-col items-center">
                <Upload size={40} className="text-gray-400 mb-3" />
                <p className="text-black font-bold mb-1 text-sm md:text-base">Click to select multiple files</p>
                <p className="text-gray-500 text-xs md:text-sm">Supported formats: .PDF, .EPUB</p>
              </div>
            </div>

            {/* File List */}
            {fileStatuses.length > 0 && (
              <div className="mt-6 flex-1 overflow-y-auto no-scrollbar min-h-[100px] border border-gray-100 rounded-xl p-2">
                <div className="flex flex-col gap-3">
                  {fileStatuses.map((fs, idx) => (
                    <div key={`${fs.file.name}-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg relative overflow-hidden">
                      {/* Background Progress Bar */}
                      {fs.status === 'uploading' && (
                        <div 
                          className="absolute top-0 left-0 bottom-0 bg-[#F5ECDC]/30 transition-all duration-300 z-0" 
                          style={{ width: `${fs.progress}%` }} 
                        />
                      )}
                      
                      <div className="z-10 bg-white p-2 rounded-md shadow-sm border border-gray-100">
                        <FileIcon size={20} className="text-gray-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0 z-10">
                        <p className="text-sm font-bold text-gray-800 truncate">{fs.file.name}</p>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs text-gray-500">{(fs.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                          {fs.status === 'uploading' && <span className="text-xs font-bold text-black">{fs.progress}%</span>}
                          {fs.status === 'error' && <span className="text-xs font-bold text-red-500">{fs.errorMessage}</span>}
                          {fs.status === 'success' && <span className="text-xs font-bold text-green-600">Thành công</span>}
                        </div>
                      </div>

                      <div className="z-10 ml-2">
                        {fs.status === 'success' && <CheckCircle2 size={20} className="text-green-500" />}
                        {fs.status === 'error' && <AlertCircle size={20} className="text-red-500" />}
                        {fs.status === 'uploading' && <Loader2 size={18} className="animate-spin text-gray-400" />}
                        {fs.status === 'pending' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-md transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100">
              <button 
                onClick={handleUpload}
                disabled={fileStatuses.length === 0 || isUploading || !fileStatuses.some(f => f.status === 'pending' || f.status === 'error')}
                className="w-full py-3.5 rounded-xl bg-black hover:bg-gray-800 text-white font-bold disabled:opacity-50 disabled:hover:bg-black flex items-center justify-center transition-colors cursor-pointer"
              >
                {isUploading ? (
                  <><Loader2 size={18} className="animate-spin mr-2" /> Đang xử lý...</>
                ) : 'Upload Books'}
              </button>
            </div>
            
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
