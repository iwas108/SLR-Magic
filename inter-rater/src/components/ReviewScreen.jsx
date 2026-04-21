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

  if (!session || !currentRow) return <div className="p-4">Loading...</div>;

  return (
    <div className="container mt-3 mb-5 pb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Reviewing: {session.filename}</h4>
        <span className="badge bg-secondary">
          {currentIndex + 1} of {session.data.length}
        </span>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h5 className="card-title text-primary">{currentRow.Title || 'No Title Provided'}</h5>
          <h6 className="card-subtitle mb-3 text-muted">ID: {currentRow.Paper_ID}</h6>

          <div className="accordion mb-3" id="paperAccordion">
            <div className="accordion-item">
              <h2 className="accordion-header">
                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAbstract">
                  View Abstract
                </button>
              </h2>
              <div id="collapseAbstract" className="accordion-collapse collapse" data-bs-parent="#paperAccordion">
                <div className="accordion-body">
                  {currentRow.Abstract || 'No abstract available.'}
                </div>
              </div>
            </div>
            <div className="accordion-item">
              <h2 className="accordion-header">
                <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAI">
                  AI Decision & Reasoning
                </button>
              </h2>
              <div id="collapseAI" className="accordion-collapse collapse show" data-bs-parent="#paperAccordion">
                <div className="accordion-body">
                  <p><strong>Decision:</strong> <span className="badge bg-info">{currentRow.decision || 'N/A'}</span></p>
                  <p><strong>Reasoning:</strong> {currentRow.reasoning || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          <hr />
          <h5>Human Quality Check</h5>

          <div className="mb-3 form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="decisionAgree"
              checked={currentRow.HUMAN_QC_Decision_Agree === 'TRUE' || currentRow.HUMAN_QC_Decision_Agree === true}
              onChange={(e) => handleInputChange('HUMAN_QC_Decision_Agree', e.target.checked ? 'TRUE' : 'FALSE')}
            />
            <label className="form-check-label" htmlFor="decisionAgree">
              Agree with AI Decision
            </label>
          </div>

          <div className="mb-3 form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="reasonValid"
              checked={currentRow.HUMAN_QC_Reason_Valid === 'TRUE' || currentRow.HUMAN_QC_Reason_Valid === true}
              onChange={(e) => handleInputChange('HUMAN_QC_Reason_Valid', e.target.checked ? 'TRUE' : 'FALSE')}
            />
            <label className="form-check-label" htmlFor="reasonValid">
              AI Reasoning is Valid
            </label>
          </div>

          <div className="mb-3">
            <label htmlFor="extractionScore" className="form-label">Data Extraction Score (1-5)</label>
            <select
              className="form-select"
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

          <div className="mb-3">
            <label htmlFor="criticalCorrection" className="form-label">Critical Correction (Optional)</label>
            <textarea
              className="form-control"
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
      <div className="fixed-bottom bg-body-tertiary border-top p-3 d-flex justify-content-between align-items-center shadow-lg">
        <button
          className="btn btn-secondary"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          Previous
        </button>

        <button
          className="btn btn-outline-dark"
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </button>

        {currentIndex === session.data.length - 1 ? (
          <button className="btn btn-success" onClick={handleComplete}>
            Complete Review
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleNext}>
            Next
          </button>
        )}
      </div>
    </div>
  );
};

export default ReviewScreen;
