import React from 'react';

const BlindedReviewForm = ({ currentRow, handleInputChange, ecRules }) => {
  return (
    <>
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Reviewer Decision <span className="text-red-500">*</span></label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="decision"
              value="Include"
              checked={currentRow.Reviewer_Decision === 'Include'}
              onChange={(e) => handleInputChange('Reviewer_Decision', e.target.value)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-gray-900 dark:text-gray-300">Include</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="decision"
              value="Exclude"
              checked={currentRow.Reviewer_Decision === 'Exclude'}
              onChange={(e) => handleInputChange('Reviewer_Decision', e.target.value)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-gray-900 dark:text-gray-300">Exclude</span>
          </label>
        </div>
      </div>

      {currentRow.Reviewer_Decision === 'Exclude' && ecRules && ecRules.length > 0 && (
        <div className="mb-6">
          <label htmlFor="reviewerECCode" className="block text-sm font-medium mb-2">Exclusion Code (EC Rule) <span className="text-red-500">*</span></label>
          <select
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            id="reviewerECCode"
            value={currentRow.Reviewer_EC_Code || ''}
            onChange={(e) => handleInputChange('Reviewer_EC_Code', e.target.value)}
            required
          >
            <option value="" disabled>Select an EC Code...</option>
            {ecRules.map((rule, idx) => (
              <option key={idx} value={rule.code}>
                {rule.code}
              </option>
            ))}
          </select>
          {currentRow.Reviewer_EC_Code && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm text-gray-700 dark:text-gray-300">
              {ecRules.find((r) => r.code === currentRow.Reviewer_EC_Code)?.description}
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <label htmlFor="reviewerReasoning" className="block text-sm font-medium mb-2">Reviewer Reasoning <span className="text-red-500">*</span></label>
        <textarea
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          id="reviewerReasoning"
          rows="4"
          value={currentRow.Reviewer_Reasoning || ''}
          onChange={(e) => handleInputChange('Reviewer_Reasoning', e.target.value)}
          placeholder="Explain your decision..."
          required
        ></textarea>
      </div>

      <div className="mb-6">
        <label htmlFor="reviewerConfidence" className="block text-sm font-medium mb-2">Confidence Score (1=Low, 5=High) <span className="text-red-500">*</span></label>
        <select
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          id="reviewerConfidence"
          value={currentRow.Reviewer_Confidence || ''}
          onChange={(e) => handleInputChange('Reviewer_Confidence', e.target.value)}
          required
        >
          <option value="" disabled>Select a score...</option>
          <option value="1">1 - Low</option>
          <option value="2">2 - Fair</option>
          <option value="3">3 - Good</option>
          <option value="4">4 - High</option>
          <option value="5">5 - Very High</option>
        </select>
      </div>
    </>
  );
};

export default BlindedReviewForm;
