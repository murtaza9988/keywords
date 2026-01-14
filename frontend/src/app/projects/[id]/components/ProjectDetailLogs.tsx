"use client";

import React from 'react';
import { LogsTable } from './LogsTable';

interface ProjectDetailLogsProps {
  projectId: string;
  isActive: boolean;
  refreshKey: number;
}

export function ProjectDetailLogs({
  projectId,
  isActive,
  refreshKey,
}: ProjectDetailLogsProps): React.ReactElement {
  return (
    <LogsTable
      projectId={projectId}
      isActive={isActive}
      refreshKey={refreshKey}
    />
  );
}
