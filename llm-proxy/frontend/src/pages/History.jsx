import { useEffect, useState, useCallback } from "react";
import {
  fetchHistory,
  deleteHistoryItem,
  bulkDeleteHistory,
  clearHistory,
  fetchEndpoints,
  fetchResearchContexts,
  fetchMetaPromptTemplates,
} from "../services/api";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  X,
  Trash2,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format } from "date-fns";

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [endpoints, setEndpoints] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState("id");
  const [sortDesc, setSortDesc] = useState(true);

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal State
  const [showRefinementModal, setShowRefinementModal] = useState(false);
  const [researchContexts, setResearchContexts] = useState([]);
  const [metaPromptTemplates, setMetaPromptTemplates] = useState([]);
  const [selectedRcId, setSelectedRcId] = useState("");
  const [selectedMptId, setSelectedMptId] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  const handleGenerateRefinementPrompt = () => {
    if (!selectedRequest) return;
    const rc =
      researchContexts.find((r) => r.id === parseInt(selectedRcId)) ||
      researchContexts[0];
    const mpt =
      metaPromptTemplates.find((m) => m.id === parseInt(selectedMptId)) ||
      metaPromptTemplates[0];

    if (!rc || !mpt) {
      setGeneratedPrompt(
        "Please select a Research Context and Meta Prompt Template first.",
      );
      return;
    }

    let result = mpt.content;
    result = result.replace(/\{\{Research Context\}\}/gi, rc.content);
    result = result.replace(/\{\{Input Prompt\}\}/gi, selectedRequest.prompt || "");
    result = result.replace(
      /\{\{Thinking Trace\}\}/gi,
      selectedRequest.thinking || "None",
    );
    result = result.replace(/\{\{Output\}\}/gi, selectedRequest.response || "");
    result = result.replace(
      /\{\{Execution Duration\}\}/gi,
      formatTime(selectedRequest.total_duration),
    );

    result = result.replace(
      /\{\{Model\}\}/gi,
      selectedRequest.model || "Unknown Model",
    );

    result = result.replace(
      /\{\{GPU\}\}/gi,
      selectedRequest.hardware?.gpu_model || "Unknown GPU",
    );
    result = result.replace(
      /\{\{CPU\}\}/gi,
      selectedRequest.hardware?.cpu_model || "Unknown CPU",
    );
    result = result.replace(
      /\{\{RAM\}\}/gi,
      selectedRequest.hardware?.ram_size || "Unknown RAM",
    );

    setGeneratedPrompt(result);
  };

  useEffect(() => {
    if (showRefinementModal) {
      handleGenerateRefinementPrompt();
    }
  }, [selectedRcId, selectedMptId, showRefinementModal]);

  const handleCopyRefinement = () => {
    navigator.clipboard
      .writeText(generatedPrompt)
      .then(() => {
        alert("Prompt copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy", err);
        // Fallback is manual copy from the textarea
      });
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [historyData, endpointsData, rcData, mptData] = await Promise.all([
        fetchHistory({
          page,
          limit,
          search,
          endpoint: endpointFilter,
          sort_by: sortBy,
          sort_desc: sortDesc,
          time_start: timeStart ? new Date(timeStart).toISOString() : null,
          time_end: timeEnd ? new Date(timeEnd).toISOString() : null,
        }),
        fetchEndpoints(),
        fetchResearchContexts(),
        fetchMetaPromptTemplates(),
      ]);

      setHistory(historyData.history || []);
      setTotal(historyData.total || 0);
      setEndpoints(endpointsData || []);
      setResearchContexts(rcData || []);
      setMetaPromptTemplates(mptData || []);
      if (rcData && rcData.length > 0) setSelectedRcId(rcData[0].id);
      if (mptData && mptData.length > 0) setSelectedMptId(mptData[0].id);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    endpointFilter,
    sortBy,
    sortDesc,
    timeStart,
    timeEnd,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(true);
    }
    setPage(1); // Reset to first page on sort
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleEndpointChange = (e) => {
    setEndpointFilter(e.target.value);
    setPage(1);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this record?")) {
      try {
        await deleteHistoryItem(id);
        loadData();
        setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
      } catch (error) {
        console.error("Error deleting item:", error);
        alert("Failed to delete item");
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      window.confirm(
        `Are you sure you want to delete ${selectedIds.length} selected records?`,
      )
    ) {
      try {
        await bulkDeleteHistory(selectedIds);
        setSelectedIds([]);
        loadData();
      } catch (error) {
        console.error("Error in bulk delete:", error);
        alert("Failed to delete selected items");
      }
    }
  };

  const handleClearAll = async () => {
    if (
      window.confirm(
        "WARNING: Are you sure you want to completely clear ALL history records? This cannot be undone.",
      )
    ) {
      try {
        await clearHistory();
        setSelectedIds([]);
        setPage(1);
        loadData();
      } catch (error) {
        console.error("Error clearing history:", error);
        alert("Failed to clear history");
      }
    }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(history.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const openModal = (request, index) => {
    setSelectedRequest(request);
    setSelectedIndex(index);
  };

  const closeModal = () => {
    setSelectedRequest(null);
    setSelectedIndex(-1);
  };

  const navigatePrev = () => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1;
      setSelectedRequest(history[newIndex]);
      setSelectedIndex(newIndex);
    }
  };

  const navigateNext = () => {
    if (selectedIndex < history.length - 1) {
      const newIndex = selectedIndex + 1;
      setSelectedRequest(history[newIndex]);
      setSelectedIndex(newIndex);
    }
  };

  const copyRefinementPrompt = () => {
    if (!selectedRequest) return;
    const prompt = `<research_context>\n</research_context>\n\n<task>\n</task>\n\n<original_prompt>\n${selectedRequest.prompt}\n</original_prompt>\n\n<model_response>\n${selectedRequest.response}\n</model_response>\n\n<critique>\n</critique>\n\n<refinement>\n</refinement>`;
    navigator.clipboard.writeText(prompt).then(() => {
      alert("Refinement prompt copied to clipboard!");
    });
  };

  const formatTime = (ms) => {
    if (!ms) return "-";
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) {
      return totalSeconds.toFixed(2) + " s";
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(0);
    return `${minutes} m ${seconds} s`;
  };

  const renderSortIcon = (column) => {
    if (sortBy !== column) return null;
    return sortDesc ? (
      <ArrowDown className="w-4 h-4 inline ml-1" />
    ) : (
      <ArrowUp className="w-4 h-4 inline ml-1" />
    );
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">History</h2>
          <div className="flex gap-2">
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear All History
            </button>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="col-span-1 lg:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search payload..."
              value={search}
              onChange={handleSearchChange}
              className="pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
          </div>

          <div>
            <select
              value={endpointFilter}
              onChange={handleEndpointChange}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            >
              <option value="">All Endpoints</option>
              {endpoints.map((ep) => (
                <option key={ep} value={ep}>
                  {ep}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="datetime-local"
              value={timeStart}
              onChange={(e) => {
                setTimeStart(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              title="Start Time"
            />
          </div>
          <div>
            <input
              type="datetime-local"
              value={timeEnd}
              onChange={(e) => {
                setTimeEnd(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              title="End Time"
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-4 flex items-center bg-blue-50 p-3 rounded-md">
            <span className="text-blue-800 mr-4 font-medium">
              {selectedIds.length} items selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Loading history...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        history.length > 0 &&
                        selectedIds.length === history.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("timestamp")}
                  >
                    Timestamp {renderSortIcon("timestamp")}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("endpoint_url")}
                  >
                    Endpoint {renderSortIcon("endpoint_url")}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("model")}
                  >
                    Model {renderSortIcon("model")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Prompt (Truncated)
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("duration_ms")}
                  >
                    Duration {renderSortIcon("duration_ms")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No history records found.
                    </td>
                  </tr>
                ) : (
                  history.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => openModal(item, index)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer text-gray-900 dark:text-gray-100"
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(e) => toggleSelect(item.id, e)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {format(
                          new Date(item.timestamp),
                          "yyyy-MM-dd HH:mm:ss",
                        )}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]"
                        title={item.endpoint}
                      >
                        {item.endpoint || "-"}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[150px]"
                        title={item.model}
                      >
                        {item.model}
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate"
                        title={item.prompt}
                      >
                        {item.prompt}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(item.total_duration)}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 mt-4">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Showing{" "}
                  <span className="font-medium">{(page - 1) * limit + 1}</span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(page * limit, total)}
                  </span>{" "}
                  of <span className="font-medium">{total}</span> results
                </p>
              </div>
              <div>
                <div className="flex gap-2 items-center">
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="border-gray-300 dark:border-gray-600 rounded-md text-sm py-1 dark:bg-gray-700 dark:text-gray-200"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                  <nav
                    className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Request Details
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5 dark:text-gray-300" />
                </button>
              </div>

              <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={navigatePrev}
                    disabled={selectedIndex === 0}
                    className="px-3 py-1 bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded shadow-sm disabled:opacity-50 flex items-center hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                  </button>
                  <button
                    onClick={navigateNext}
                    disabled={selectedIndex === history.length - 1}
                    className="px-3 py-1 bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded shadow-sm disabled:opacity-50 flex items-center hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    handleGenerateRefinementPrompt();
                    setShowRefinementModal(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 flex items-center"
                >
                  <Copy className="w-4 h-4 mr-1" /> Copy Refinement Prompt
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border dark:border-gray-700 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase block mb-1">
                        Model
                      </span>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-200">
                        {selectedRequest.model}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase block mb-1">
                        Endpoint
                      </span>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-200">
                        {selectedRequest.endpoint || "N/A"}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase block mb-1">
                        Tokens (Prompt/Completion)
                      </span>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-200">
                        {selectedRequest.prompt_tokens} /{" "}
                        {selectedRequest.completion_tokens}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase block mb-1">
                        Total Duration
                      </span>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-200">
                        {formatTime(selectedRequest.total_duration)}
                      </div>
                    </div>
                  </div>

                  {selectedRequest.hardware && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t dark:border-gray-700">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase block mb-1">
                          GPU
                        </span>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-200">
                          {selectedRequest.hardware.gpu_model || "N/A"}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase block mb-1">
                          CPU
                        </span>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-200">
                          {selectedRequest.hardware.cpu_model || "N/A"}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase block mb-1">
                          RAM
                        </span>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-200">
                          {selectedRequest.hardware.ram_size || "N/A"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Prompt
                  </h4>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                    {selectedRequest.prompt}
                  </pre>
                </div>

                {selectedRequest.thinking && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Thinking Process
                    </h4>
                    <pre className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-yellow-200 dark:border-yellow-900/50 text-gray-600 dark:text-gray-400 italic">
                      {selectedRequest.thinking}
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Response
                  </h4>
                  <pre className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-blue-200 dark:border-blue-900/50 text-gray-900 dark:text-gray-200">
                    {selectedRequest.response}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Refinement Prompt Modal */}
      {showRefinementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-11/12 max-w-4xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold dark:text-white">Copy Refinement Prompt</h2>
              <button
                onClick={() => setShowRefinementModal(false)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
              >
                <X className="w-5 h-5 dark:text-gray-300" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Research Context
                  </label>
                  <select
                    value={selectedRcId}
                    onChange={(e) => setSelectedRcId(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    {researchContexts.map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Meta Prompt Template
                  </label>
                  <select
                    value={selectedMptId}
                    onChange={(e) => setSelectedMptId(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    {metaPromptTemplates.map((mpt) => (
                      <option key={mpt.id} value={mpt.id}>
                        {mpt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Generated Prompt
                </label>
                <textarea
                  readOnly
                  value={generatedPrompt}
                  rows={15}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm resize-y"
                />
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex justify-end space-x-2">
              <button
                onClick={() => setShowRefinementModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                Close
              </button>
              <button
                onClick={handleCopyRefinement}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Copy className="w-4 h-4" />
                <span>Copy to Clipboard</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default History;
