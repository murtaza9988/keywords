import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/apiClient';
import { ChevronDown, FileText } from 'lucide-react';
import { CSVUpload } from '@/lib/types';

interface CSVUploadDropdownProps {
  projectId: string;
}

const CSVUploadDropdown: React.FC<CSVUploadDropdownProps> = ({ projectId }) => {
  const [csvUploads, setCsvUploads] = useState<CSVUpload[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCSVUploads = async () => {
      setIsLoading(true);
      try {
        const uploads = await apiClient.fetchCSVUploads(projectId);
        setCsvUploads(uploads);
      } catch (error) {
        console.error('Error fetching CSV uploads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchCSVUploads();
    }
  }, [projectId]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center space-x-2 cursor-pointer  text-gray-800 px-4 py-1.5 "
        disabled={isLoading}
      >
        <FileText className="h-5 w-5" />
        <span className='mx-1 truncate'>CSV Uploads ({csvUploads.length})</span>
        <ChevronDown className={`h-5 w-5 transform  ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute mt-2 w-64 bg-white shadow-lg border border-gray-200 rounded-lg z-10">
          <div className="p-2 max-h-60 overflow-y-auto">
            {csvUploads.length === 0 ? (
              <p className="text-gray-500 text-[13px] p-2">No CSV uploads yet.</p>
            ) : (
              csvUploads.map((upload) => (
                <div key={upload.id} className="p-2 hover:bg-gray-100">
                  <p className="text-[13px] font-medium">{upload.file_name}</p>
                  <p className="text-[13px] text-gray-800">
                    Uploaded: {new Date(upload.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVUploadDropdown;