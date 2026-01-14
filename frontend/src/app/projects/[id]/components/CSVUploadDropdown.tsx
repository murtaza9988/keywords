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
        className="flex items-center gap-2 cursor-pointer text-foreground px-3 py-2 text-xs font-medium rounded-md border border-border bg-white shadow-sm hover:bg-surface-muted transition-colors"
        disabled={isLoading}
      >
        <FileText className="h-4 w-4 text-muted" />
        <span className="truncate">CSV Uploads ({csvUploads.length})</span>
        <ChevronDown className={`h-4 w-4 text-muted transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute mt-2 w-64 bg-white shadow-lg border border-border rounded-lg z-10">
          <div className="p-2 max-h-60 overflow-y-auto">
            {csvUploads.length === 0 ? (
              <p className="text-muted text-[13px] p-2">No CSV uploads yet.</p>
            ) : (
              csvUploads.map((upload) => (
                <div key={upload.id} className="p-2 hover:bg-surface-muted rounded-md">
                  <p className="text-[13px] font-medium text-foreground">{upload.file_name}</p>
                  <p className="text-[13px] text-muted">
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
