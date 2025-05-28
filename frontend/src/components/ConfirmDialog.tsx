import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning'
}) => {
  if (!isOpen) return null;
  
  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-500 bg-red-100',
          confirm: 'bg-red-500 hover:bg-red-600'
        };
      case 'warning':
        return {
          icon: 'text-amber-500 bg-amber-100',
          confirm: 'bg-amber-500 hover:bg-amber-600'
        };
      default:
        return {
          icon: 'text-blue-500 bg-blue-100',
          confirm: 'bg-blue-500 hover:bg-blue-600'
        };
    }
  };
  
  const colors = getColors();
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 overflow-hidden">
        <div className="p-4 flex justify-between items-center border-b border-gray-100">
          <div className="flex items-center">
            <div className={`p-2 rounded-full mr-3 ${colors.icon}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-gray-900">{title}</h3>
          </div>
          <button 
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 rounded-full p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5">
          <p className="text-gray-600">{message}</p>
        </div>
        
        <div className="bg-gray-50 p-4 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${colors.confirm}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
