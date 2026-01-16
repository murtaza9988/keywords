import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/apiClient';
import { ChevronDown, Download, FileText } from 'lucide-react';
import { CSVUpload } from '@/lib/types';

interface CSVUploadDropdownProps {
  projectId: string;
  refreshKey?: number;
}

const CSVUploadDropdown: React.FC<CSVUploadDropdownProps> = ({ projectId, refreshKey }) => {
  const [csvUploads, setCsvUploads] = useState<CSVUpload[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

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
  }, [projectId, refreshKey]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleDownload = async (upload: CSVUpload) => {
    if (!projectId || downloadingId === upload.id) return;
    setDownloadingId(upload.id);
    try {
      const blobData = await apiClient.downloadCSVUpload(projectId, upload.id);
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', upload.file_name);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading CSV upload:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 cursor-pointer text-foreground px-3 py-2 text-ui-meta font-medium rounded-md border border-border bg-white shadow-sm hover:bg-surface-muted transition-colors"
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
                <div
                  key={upload.id}
                  className="flex items-start justify-between gap-3 p-2 hover:bg-surface-muted rounded-md"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{upload.file_name}</p>
                    <p className="text-[13px] text-muted">
                      Uploaded: {new Date(upload.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(upload)}
                    disabled={downloadingId === upload.id}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                    title="Download this CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloadingId === upload.id ? '...' : 'Download'}
                  </button>
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
