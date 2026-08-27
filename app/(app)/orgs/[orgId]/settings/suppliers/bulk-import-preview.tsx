"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";

interface BulkImportResultError {
  rowNumber: number;
  data: any;
  errors: string[];
}

interface BulkImportResultProps {
  result: {
    success: number;
    failed: number;
    errors?: BulkImportResultError[];
    message: string;
  };
}

export function BulkImportPreview({ result }: BulkImportResultProps) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Successful</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{result.success}</div>
        </div>
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-900">Failed</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{result.failed}</div>
        </div>
      </div>

      {/* Message */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">{result.message}</p>
      </div>

      {/* Error Details */}
      {result.errors && result.errors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Error Details</h3>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Errors</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((error) => (
                  <tr key={`${error.rowNumber}`} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">{error.rowNumber}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs truncate">{error.data.email || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        {error.errors.map((err, idx) => (
                          <div key={idx} className="text-xs text-red-700 flex gap-1">
                            <span className="text-red-500">•</span>
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
