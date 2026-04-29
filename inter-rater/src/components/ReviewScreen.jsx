import React, { useState, useEffect } from 'react';
import { StorageService } from '../StorageService';
import BlindedReviewForm from './BlindedReviewForm';

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

  const isCurrentRowValid = () => {
    if (!currentRow) return false;
let isValid =
      currentRow.Reviewer_Decision &&
      currentRow.Reviewer_Reasoning &&
      currentRow.Reviewer_Reasoning.trim() !== '' &&
      currentRow.Reviewer_Confidence;

    // Validate EC Code if decision is Exclude and EC rules exist
    if (currentRow.Reviewer_Decision === 'Exclude' && session.metadata?.ecRules?.length > 0) {
      if (!currentRow.Reviewer_EC_Code) {
        isValid = false;
      }
    }

    return isValid;
  };

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

          <div className="border border-gray-200 dark:border-gray-700 rounded-md mb-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-medium">
              Abstract
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {currentRow.Abstract || 'No abstract available.'}
            </div>
          </div>

          <hr className="my-6 border-gray-200 dark:border-gray-700" />
          <h5 className="text-lg font-bold mb-4">Blinded Review</h5>

          <BlindedReviewForm
            currentRow={currentRow}
            handleInputChange={handleInputChange}
            ecRules={session.metadata?.ecRules || []}
          />

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
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleComplete}
            disabled={!isCurrentRowValid()}
          >
            Complete Review
          </button>
        ) : (
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleNext}
            disabled={!isCurrentRowValid()}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
};

export default ReviewScreen;
