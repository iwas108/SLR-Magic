import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';

const ReviewScreen = ({ sessionId, onNavigate }) => {
  const [session, setSession] = useState(null);
  const [currentRow, setCurrentRow] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const s = StorageService.getSession(sessionId);
    if (s) {
      setSession(s);
      setCurrentIndex(s.currentIndex || 0);
      setCurrentRow(s.data[s.currentIndex || 0]);
    } else {
      onNavigate('dashboard');
    }
  }, [sessionId, onNavigate]);

  const handleInputChange = (field, value) => {
    const updatedRow = { ...currentRow, [field]: value };
    setCurrentRow(updatedRow);

    // Auto-save
    const updatedData = [...session.data];
    updatedData[currentIndex] = updatedRow;

    StorageService.updateSession(sessionId, {
      data: updatedData,
      status: 'in-progress'
    });
    setSession(prev => ({ ...prev, data: updatedData }));
  };

  const handleNext = () => {
    if (currentIndex < session.data.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setCurrentRow(session.data[nextIndex]);
      StorageService.updateSession(sessionId, { currentIndex: nextIndex });
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setCurrentRow(session.data[prevIndex]);
      StorageService.updateSession(sessionId, { currentIndex: prevIndex });
    }
  };

  const handleComplete = () => {
    StorageService.updateSession(sessionId, { status: 'completed' });
    onNavigate('dashboard');
  };

  const [openSection, setOpenSection] = useState('ai');

  if (!session || !currentRow) return <div className="p-4">Loading...</div>;

  return (
    <div className="container mx-auto px-4 mt-6 mb-24">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-xl font-bold">Reviewing: {session.filename}</h4>
        <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm font-semibold">
          {currentIndex + 1} of {session.data.length}
        </span>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-6">
          <h5 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-2">{currentRow.Title || 'No Title Provided'}</h5>
          <h6 className="text-sm text-gray-500 dark:text-gray-400 mb-6">ID: {currentRow.Paper_ID}</h6>

          <div className="border border-gray-200 dark:border-gray-700 rounded-md mb-6 divide-y divide-gray-200 dark:divide-gray-700">
            <div>
              <button
                className="w-full text-left px-4 py-3 font-medium bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none flex justify-between items-center"
                onClick={() => setOpenSection(openSection === 'abstract' ? '' : 'abstract')}
              >
                View Abstract
                <span>{openSection === 'abstract' ? '▲' : '▼'}</span>
              </button>
              {openSection === 'abstract' && (
                <div className="p-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {currentRow.Abstract || 'No abstract available.'}
                </div>
              )}
            </div>
            <div>
              <button
                className="w-full text-left px-4 py-3 font-medium bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none flex justify-between items-center"
                onClick={() => setOpenSection(openSection === 'ai' ? '' : 'ai')}
              >
                AI Decision & Reasoning
                <span>{openSection === 'ai' ? '▲' : '▼'}</span>
              </button>
              {openSection === 'ai' && (
                <div className="p-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 space-y-2">
                  <p><strong>Decision:</strong> <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${currentRow.decision === 'Exclude' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : currentRow.decision === 'Include' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>{currentRow.decision || 'N/A'}</span></p>
                  <p><strong>Reasoning:</strong> {currentRow.reasoning || 'N/A'}</p>
                </div>
              )}
            </div>
          </div>

          <hr className="my-6 border-gray-200 dark:border-gray-700" />
          <h5 className="text-lg font-bold mb-4">Human Quality Check</h5>

          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              id="decisionAgree"
              checked={currentRow.HUMAN_QC_Decision_Agree === 'TRUE' || currentRow.HUMAN_QC_Decision_Agree === true}
              onChange={(e) => handleInputChange('HUMAN_QC_Decision_Agree', e.target.checked ? 'TRUE' : 'FALSE')}
            />
            <label className="ml-2 block text-sm text-gray-900 dark:text-gray-300" htmlFor="decisionAgree">
              Agree with AI Decision
            </label>
          </div>

          <div className="mb-6 flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              id="reasonValid"
              checked={currentRow.HUMAN_QC_Reason_Valid === 'TRUE' || currentRow.HUMAN_QC_Reason_Valid === true}
              onChange={(e) => handleInputChange('HUMAN_QC_Reason_Valid', e.target.checked ? 'TRUE' : 'FALSE')}
            />
            <label className="ml-2 block text-sm text-gray-900 dark:text-gray-300" htmlFor="reasonValid">
              AI Reasoning is Valid
            </label>
          </div>

          <div className="mb-6">
            <label htmlFor="extractionScore" className="block text-sm font-medium mb-2">Data Extraction Score (1-5)</label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              id="extractionScore"
              value={currentRow.HUMAN_QC_Data_Extraction_Score || ''}
              onChange={(e) => handleInputChange('HUMAN_QC_Data_Extraction_Score', e.target.value)}
            >
              <option value="">Select a score...</option>
              <option value="1">1 - Poor</option>
              <option value="2">2 - Fair</option>
              <option value="3">3 - Good</option>
              <option value="4">4 - Very Good</option>
              <option value="5">5 - Excellent</option>
            </select>
          </div>

          <div className="mb-2">
            <label htmlFor="criticalCorrection" className="block text-sm font-medium mb-2">Critical Correction (Optional)</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              id="criticalCorrection"
              rows="3"
              value={currentRow.HUMAN_QC_Critical_Correction || ''}
              onChange={(e) => handleInputChange('HUMAN_QC_Critical_Correction', e.target.value)}
              placeholder="Enter any manual corrections here..."
            ></textarea>
          </div>

        </div>
      </div>

      {/* Fixed bottom navigation for mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center shadow-lg">
        <button
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          Previous
        </button>

        <button
          className="px-3 py-1.5 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white rounded transition-colors text-sm"
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </button>

        {currentIndex === session.data.length - 1 ? (
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            onClick={handleComplete}
          >
            Complete Review
          </button>
        ) : (
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={handleNext}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
};

export default ReviewScreen;
