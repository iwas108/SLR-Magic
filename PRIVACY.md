# Privacy Policy

**Effective Date:** 2024-05-24

This Privacy Policy describes how SLR Magic ("we," "our," or "the Tool") accesses, uses, and handles your data when you use our Google Apps Script add-on.

## 1. Data We Access

SLR Magic is designed to operate entirely within your Google Workspace environment. We request the minimum necessary permissions to function:

*   **Google Sheets (`https://www.googleapis.com/auth/spreadsheets`):** We access the specific Google Sheet where the tool is installed to read literature review metadata and write AI analysis results.
*   **Google Drive Files (`https://www.googleapis.com/auth/drive.file`):** We only access specific files and folders (such as PDF repositories or CSV metadata files) that you explicitly select and grant permission to via the Google Picker interface.
*   **External Requests (`https://www.googleapis.com/auth/script.external_request`):** We use this to send the text content of your selected papers to external Large Language Model (LLM) APIs (like Google Gemini, vLLM, or Ollama) for processing based on your configuration.

## 2. How Data is Processed

When you initiate an AI screening or extraction task, the Tool extracts the text from your selected Google Sheet rows or explicitly authorized Drive PDFs. This text is then securely transmitted over HTTPS to the LLM API provider you have configured in the "Configuration" menu.

**Important:** We do not route your data through our own servers. Data flows directly from your Google environment to the configured LLM API.

## 3. Data Retention and Storage

*   **No Developer Storage:** The developers of SLR Magic do not collect, store, or have access to your data, your documents, or the results of your analyses.
*   **Local to Your Account:** All configuration settings, prompts, and processed results are stored locally within your specific Google Sheet using Google Apps Script Properties or directly in the sheet cells.
*   **LLM Provider Retention:** The retention of data sent to the LLM APIs depends on the specific provider you configure. Please review the privacy policies of Google Gemini, or your chosen vLLM/Ollama provider, to understand their data retention practices.

## 4. Third-Party Sharing

We do not sell, rent, or share your data with any third parties. Data is only shared with the external LLM API providers you explicitly configure in order to provide the core functionality of the Tool.

## 5. Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be reflected in this document. We encourage you to review this policy periodically.

## 6. Contact Us

If you have any questions about this Privacy Policy, please contact the repository maintainers via GitHub Issues.