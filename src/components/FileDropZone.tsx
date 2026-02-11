import React, { useState, useCallback } from 'react';
import { FileCode, ScanLine } from 'lucide-react';

interface FileDropZoneProps {
  onFileDrop: (file: File) => void;
  disabled?: boolean;
  title: string;
  description: string;
  accept: string[];
  iconType: 'ai' | 'xml';
}

export function FileDropZone({ onFileDrop, disabled, title, description, accept, iconType }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      
      const isAccepted = accept.some(ext => 
        ext === 'image/*' ? file.type.startsWith('image/') : fileExt === ext
      );

      if (isAccepted) {
        onFileDrop(file);
      } else {
        alert(`Ten moduł akceptuje tylko pliki: ${description}`);
      }
    }
  }, [onFileDrop, disabled, accept, description]);

  // --- TUTAJ JEST ZMIANA (Dodałem to samo sprawdzanie co wyżej) ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      
      // Sprawdzamy czy plik pasuje (tak samo jak przy upuszczaniu)
      const isAccepted = accept.some(ext => 
        ext === 'image/*' ? file.type.startsWith('image/') : fileExt === ext
      );

      if (isAccepted) {
        onFileDrop(file);
      } else {
        // Czyścimy input, żeby można było wybrać ten sam plik ponownie po błędzie
        e.target.value = ''; 
        alert(`Ten moduł akceptuje tylko pliki: ${description}`);
      }
    }
  };
  // -------------------------------------------------------------

  return (
    <label 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 group
        ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-[1.02] shadow-xl' 
          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-blue-400'
        }
      `}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
        <div className={`p-3 rounded-full mb-3 transition-transform group-hover:scale-110 ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
          {iconType === 'ai' ? <ScanLine size={32} /> : <FileCode size={32} />}
        </div>
        <p className="mb-1 text-sm font-bold text-gray-700 dark:text-gray-200">
          {title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isDragging ? "Upuść plik tutaj" : description}
        </p>
      </div>
      <input 
        type="file" 
        className="hidden" 
        onChange={handleChange} 
        disabled={disabled}
        accept={accept.join(',')}
      />
    </label>
  );
}